from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime, timezone
import re
import io
import csv
import openpyxl
from openpyxl.styles import Font
import PyPDF2
import logging
from google.cloud import firestore
import database
from auth import get_current_user, User
from ai_advisor import get_ai_financial_advice, stream_ai_financial_advice, keep_model_warm, FinancialAdviceSchema, get_ai_risk_score

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Schemas
class TransactionCreate(BaseModel):
    amount: float
    type: str # 'income' or 'expense'
    category: str
    description: Optional[str] = None

class TransactionResponse(BaseModel):
    id: str
    amount: float
    type: str
    category: str
    description: Optional[str]
    date: datetime
    
    class Config:
        from_attributes = True

class BudgetCreate(BaseModel):
    limit_amount: float

class BudgetResponse(BaseModel):
    id: str
    limit_amount: float
    
    class Config:
        from_attributes = True

class AnalyticsSummary(BaseModel):
    total_income: float
    total_expenses: float
    expenses_by_category: Dict[str, float]
    financial_advice: List[str] = []
    ai_advisor_output: Optional[FinancialAdviceSchema] = None

class RecurringExpenseCreate(BaseModel):
    amount: float
    category: str
    description: Optional[str] = None
    day_of_month: int # 1-31
    total_months: int

class RecurringExpenseResponse(BaseModel):
    id: str
    amount: float
    category: str
    description: Optional[str]
    day_of_month: int
    total_months: int
    months_paid: int
    next_deduction_date: datetime
    status: str # 'active', 'completed'
    
    class Config:
        from_attributes = True

@router.post("/", response_model=TransactionResponse)
def add_transaction(transaction: TransactionCreate, db: firestore.Client = Depends(database.get_db), current_user: User = Depends(get_current_user)):
    if transaction.type not in ['income', 'expense']:
        raise HTTPException(status_code=400, detail="Invalid transaction type")
    
    trans_data = transaction.model_dump()
    trans_data['user_id'] = current_user.id
    trans_data['date'] = datetime.now(timezone.utc)
    
    update_time, doc_ref = db.collection('transactions').add(trans_data)
    
    trans_data['id'] = doc_ref.id
    return trans_data

@router.get("/", response_model=List[TransactionResponse])
def get_transactions(db: firestore.Client = Depends(database.get_db), current_user: User = Depends(get_current_user)):
    # Simplified query to avoid composite index requirement
    transactions_ref = db.collection('transactions').where('user_id', '==', current_user.id).stream()
    
    transactions = []
    for doc in transactions_ref:
        data = doc.to_dict()
        data['id'] = doc.id
        transactions.append(data)
        
    # Sort in memory instead
    transactions.sort(key=lambda x: x.get('date'), reverse=True)
    return transactions

@router.post("/budget", response_model=BudgetResponse)
def set_budget(budget: BudgetCreate, db: firestore.Client = Depends(database.get_db), current_user: User = Depends(get_current_user)):
    budgets_ref = db.collection('budgets').where('user_id', '==', current_user.id).limit(1).stream()
    budget_doc = next(budgets_ref, None)
    
    if budget_doc:
        budget_doc.reference.update({'limit_amount': budget.limit_amount})
        return {"id": budget_doc.id, "limit_amount": budget.limit_amount}
    else:
        new_budget = {
            'user_id': current_user.id,
            'limit_amount': budget.limit_amount
        }
        update_time, doc_ref = db.collection('budgets').add(new_budget)
        return {"id": doc_ref.id, "limit_amount": budget.limit_amount}

@router.get("/budget", response_model=Optional[BudgetResponse])
def get_budget(db: firestore.Client = Depends(database.get_db), current_user: User = Depends(get_current_user)):
    budgets_ref = db.collection('budgets').where('user_id', '==', current_user.id).limit(1).stream()
    budget_doc = next(budgets_ref, None)
    if budget_doc:
        data = budget_doc.to_dict()
        data['id'] = budget_doc.id
        return data
    return None

@router.get("/analytics", response_model=AnalyticsSummary)
async def get_analytics(db: firestore.Client = Depends(database.get_db), current_user: User = Depends(get_current_user)):
    transactions_ref = db.collection('transactions').where('user_id', '==', current_user.id).stream()
    
    total_income = 0.0
    total_expenses = 0.0
    expenses_by_category = {}
    all_transactions = []
    
    for doc in transactions_ref:
        t = doc.to_dict()
        all_transactions.append(t)
        amount = t.get('amount', 0)
        t_type = t.get('type')
        category = t.get('category')
        
        if t_type == 'income':
            total_income += amount
        elif t_type == 'expense':
            total_expenses += amount
            if category in expenses_by_category:
                expenses_by_category[category] += amount
            else:
                expenses_by_category[category] = amount
                
    advice = []
    
    # 1. Savings Rate Advice
    if total_income > 0:
        savings_rate = ((total_income - total_expenses) / total_income) * 100
        if savings_rate >= 20:
            advice.append(f"Great job! You are saving {savings_rate:.1f}% of your income, which meets the recommended 20% goal.")
        elif savings_rate > 0:
            advice.append(f"You saved {savings_rate:.1f}% of your income. Try to reduce discretionary spending to reach a 20% savings goal.")
        else:
            advice.append("Alert: Your expenses exceed your income. Please review your spending to avoid debt.")
    elif total_expenses > 0:
        advice.append("Alert: You have expenses but no recorded income. Make sure to log your income to track net savings.")
            
    # 2. Category Advice (Top Spending)
    if expenses_by_category:
        top_category = max(expenses_by_category.items(), key=lambda x: x[1])
        cat_name, cat_amount = top_category
        cat_percent = (cat_amount / total_expenses) * 100 if total_expenses > 0 else 0
        
        if cat_percent > 30:
            advice.append(f"Note: You're spending {cat_percent:.1f}% of your total expenses on '{cat_name}'. Consider budgeting this category better.")
        else:
            advice.append(f"Your spending is diversified. Your top expense is '{cat_name}' at {cat_percent:.1f}% of total expenses.")
            
    # 3. Budget Checking
    budgets_ref = db.collection('budgets').where('user_id', '==', current_user.id).limit(1).stream()
    budget_doc = next(budgets_ref, None)
    if budget_doc:
        limit_amount = budget_doc.to_dict().get('limit_amount', 0)
        if total_expenses > limit_amount:
            excess = total_expenses - limit_amount
            advice.append(f"Warning: You have exceeded your set budget by ₹{excess:.2f}.")
        elif total_expenses > limit_amount * 0.8:
            advice.append(f"Caution: You have used {((total_expenses/limit_amount)*100):.1f}% of your budget. Slow down spending.")

    return AnalyticsSummary(
        total_income=total_income,
        total_expenses=total_expenses,
        expenses_by_category=expenses_by_category,
        financial_advice=advice,
        ai_advisor_output=None # Set to None as it's now fetched separately
    )

class AIAdviceRequest(BaseModel):
    user_query: Optional[str] = None

@router.post("/ai-advice", response_model=FinancialAdviceSchema)
async def get_ai_advice(
    request: Optional[AIAdviceRequest] = None,
    db: firestore.Client = Depends(database.get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Independent endpoint for time-consuming AI analysis.
    Supports optional user_query for specific goals.
    """
    user_query = request.user_query if request else None
    logger.info(f"AI Advice requested by user {current_user.id}. Query: {user_query}")
    
    transactions_ref = db.collection('transactions').where('user_id', '==', current_user.id).stream()
    all_transactions = [doc.to_dict() for doc in transactions_ref]
    
    if not all_transactions:
        raise HTTPException(status_code=404, detail="No transactions found for analysis")
    
    user_query = request.user_query if request else None
    ai_output = await get_ai_financial_advice(all_transactions, user_query=user_query)
    
    if not ai_output:
        raise HTTPException(status_code=500, detail="AI Advisor failed to generate advice")
        
    return ai_output


@router.post("/ai-advice/stream")
async def stream_ai_advice(
    request: Optional[AIAdviceRequest] = None,
    db: firestore.Client = Depends(database.get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Server-Sent Events streaming endpoint for the AI advisor.
    The frontend reads tokens in real-time as the LLM generates them.
    """
    user_query = request.user_query if request else None
    logger.info(f"Streaming AI advice requested by user {current_user.id}. Query: {user_query}")

    transactions_ref = db.collection('transactions').where('user_id', '==', current_user.id).stream()
    all_transactions = [doc.to_dict() for doc in transactions_ref]

    if not all_transactions:
        raise HTTPException(status_code=404, detail="No transactions found for analysis")

    return StreamingResponse(
        stream_ai_financial_advice(all_transactions, user_query=user_query),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable nginx buffering
        }
    )

class RiskScoreRequest(BaseModel):
    liquidSavings: float
    monthlyExpenses: float
    totalIncome: float
    totalExpenses: float

@router.post("/analyze-risk")
async def analyze_risk(
    request: RiskScoreRequest,
    current_user: User = Depends(get_current_user)
):
    logger.info(f"AI Risk Score requested by user {current_user.id}")
    
    ai_output = await get_ai_risk_score(request.model_dump())
    
    if not ai_output:
        raise HTTPException(status_code=500, detail="AI Advisor failed to generate risk score")
        
    return ai_output


@router.get("/ai-warmup")
async def warmup_ai_model(current_user: User = Depends(get_current_user)):
    """
    Fire-and-forget endpoint called on dashboard mount.
    Loads the Ollama model into GPU/RAM so it is hot when the user opens AI Advisor.
    Always returns immediately — the warm-up runs in the background.
    """
    import asyncio
    asyncio.create_task(keep_model_warm())
    return {"status": "warming"}

@router.delete("/reset")
def reset_data(db: firestore.Client = Depends(database.get_db), current_user: User = Depends(get_current_user)):
    # Delete transactions
    transactions_ref = db.collection('transactions').where('user_id', '==', current_user.id).stream()
    batch = db.batch()
    count = 0
    for doc in transactions_ref:
        batch.delete(doc.reference)
        count += 1
        # Commit batches of 500
        if count % 500 == 0:
            batch.commit()
            batch = db.batch()
            
    # Delete budget
    budgets_ref = db.collection('budgets').where('user_id', '==', current_user.id).stream()
    for doc in budgets_ref:
        batch.delete(doc.reference)
        
    batch.commit()
    return {"message": "All data reset successfully"}

@router.post("/upload-statement/", response_model=Dict[str, int])
async def upload_statement(
    file: UploadFile = File(...), 
    db: firestore.Client = Depends(database.get_db), 
    current_user: User = Depends(get_current_user)
):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
    try:
        content = await file.read()
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
            
        date_pattern = re.compile(r'(\d{4}-\d{2}-\d{2})\n\d{2}:\d{2}:\d{2}(.*?)\s+([\d,]+_?\d*\.\d{2})\s+[\d,]+_?\d*\.\d{2}\s+(CR|DR)?', re.DOTALL)
        matches = date_pattern.findall(text)
        
        lines = text.split('\n')
        transactions_added = 0
        
        current_date = None
        current_desc = ""
        previous_balance = None
        
        batch = db.batch()
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            date_match = re.match(r'^(\d{4}-\d{2}-\d{2})$', line)
            if date_match:
                current_date = datetime.strptime(date_match.group(1), '%Y-%m-%d')
                current_date = current_date.replace(tzinfo=timezone.utc)
                current_desc = ""
                continue
                
            if current_date:
                amount_match = re.search(r'([\d,]+_?\d*\.\d{2})\s+([\d,]+_?\d*\.\d{2})\s*(CR|DR|cr|dr)?$', line)
                if amount_match:
                    amount_str = amount_match.group(1).replace(',', '')
                    amount = float(amount_str)
                    
                    balance_str = amount_match.group(2).replace(',', '')
                    current_balance = float(balance_str)
                    
                    if previous_balance is not None:
                        is_income = current_balance > previous_balance
                    else:
                        is_income = False
                    
                    t_type = 'income' if is_income else 'expense'
                    previous_balance = current_balance
                    
                    desc = line[:amount_match.start()].strip()
                    full_desc = (current_desc + " " + desc).strip()
                    
                    category = "Transfer" if "UPI" in full_desc else "Bank Import"
                    
                    new_ref = db.collection('transactions').document()
                    batch.set(new_ref, {
                        'user_id': current_user.id,
                        'amount': amount,
                        'type': t_type,
                        'category': category,
                        'description': full_desc[:255],
                        'date': current_date
                    })
                    
                    transactions_added += 1
                    
                    current_date = None
                    current_desc = ""
                else:
                    current_desc += " " + line

        if transactions_added > 0:
            batch.commit()
            
        return {"transactions_added": transactions_added}
        
    except Exception as e:
        print(f"Error parsing PDF: {e}")
        raise HTTPException(status_code=500, detail="Failed to process statement PDF")

@router.get("/export/csv")
def export_csv(db: firestore.Client = Depends(database.get_db), current_user: User = Depends(get_current_user)):
    transactions_ref = db.collection('transactions').where('user_id', '==', current_user.id).stream()
    
    # We create an in-memory string buffer for the CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(['Date', 'Amount', 'Type', 'Category', 'Description'])
    
    transactions = []
    for doc in transactions_ref:
        data = doc.to_dict()
        transactions.append(data)
    
    # Sort by date descending
    transactions.sort(key=lambda x: x.get('date'), reverse=True)
    
    for t in transactions:
        date_str = t.get('date').strftime('%Y-%m-%d %H:%M:%S') if t.get('date') else 'N/A'
        writer.writerow([
            date_str,
            t.get('amount', 0),
            t.get('type', 'N/A'),
            t.get('category', 'N/A'),
            t.get('description', '')
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=trackify_transactions_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

@router.get("/export/excel")
def export_excel(db: firestore.Client = Depends(database.get_db), current_user: User = Depends(get_current_user)):
    transactions_ref = db.collection('transactions').where('user_id', '==', current_user.id).stream()
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Transactions"
    
    # Header
    headers = ['Date', 'Amount', 'Type', 'Category', 'Description']
    ws.append(headers)
    
    # Style Header
    for cell in ws[1]:
        cell.font = Font(bold=True)
    
    transactions = []
    for doc in transactions_ref:
        data = doc.to_dict()
        transactions.append(data)
    
    # Sort by date descending
    transactions.sort(key=lambda x: x.get('date'), reverse=True)
    
    for t in transactions:
        date_val = t.get('date').replace(tzinfo=None) if t.get('date') else 'N/A'
        ws.append([
            date_val,
            t.get('amount', 0),
            t.get('type', 'N/A'),
            t.get('category', 'N/A'),
            t.get('description', '')
        ])
        
    # Auto-adjust column width
    for column in ws.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        ws.column_dimensions[column_letter].width = max_length + 2

    # Save to memory
    excel_file = io.BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)
    
    return Response(
        content=excel_file.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=trackify_transactions_{datetime.now().strftime('%Y%m%d')}.xlsx"}
    )

# --- Recurring Expenses Logic ---

def get_next_month_date(date: datetime, day_of_month: int):
    # Move to the next month
    if date.month == 12:
        next_month = 1
        next_year = date.year + 1
    else:
        next_month = date.month + 1
        next_year = date.year

    # Handle months with fewer days (e.g. Feb 30)
    import calendar
    last_day = calendar.monthrange(next_year, next_month)[1]
    actual_day = min(day_of_month, last_day)
    
    return datetime(next_year, next_month, actual_day, tzinfo=timezone.utc)

def process_recurring_expenses(db: firestore.Client, user_id: str):
    now = datetime.now(timezone.utc)
    recurring_ref = db.collection('recurring_expenses').where('user_id', '==', user_id).where('status', '==', 'active').stream()
    
    batch = db.batch()
    for doc in recurring_ref:
        re = doc.to_dict()
        re['id'] = doc.id
        
        while now >= re['next_deduction_date'] and re['months_paid'] < re['total_months']:
            # Create Transaction
            trans_ref = db.collection('transactions').document()
            batch.set(trans_ref, {
                'user_id': user_id,
                'amount': re['amount'],
                'type': 'expense',
                'category': re['category'],
                'description': f"{re['description']} (EMI {re['months_paid'] + 1}/{re['total_months']})",
                'date': re['next_deduction_date'],
                'is_recurring': True
            })
            
            # Update Recurring Record
            re['months_paid'] += 1
            re['next_deduction_date'] = get_next_month_date(re['next_deduction_date'], re['day_of_month'])
            
            if re['months_paid'] >= re['total_months']:
                re['status'] = 'completed'
                break
        
        # Update the recurring expense doc
        batch.update(doc.reference, {
            'months_paid': re['months_paid'],
            'next_deduction_date': re['next_deduction_date'],
            'status': re['status']
        })
        
    batch.commit()

@router.post("/recurring", response_model=RecurringExpenseResponse)
def add_recurring_expense(re_data: RecurringExpenseCreate, db: firestore.Client = Depends(database.get_db), current_user: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    
    # Calculate initial next_deduction_date
    # If today's day is already past day_of_month, start from next month
    # Otherwise, start from this month
    if now.day > re_data.day_of_month:
        # Start next month
        import calendar
        next_month = now.month + 1 if now.month < 12 else 1
        year = now.year if now.month < 12 else now.year + 1
        last_day = calendar.monthrange(year, next_month)[1]
        start_date = datetime(year, next_month, min(re_data.day_of_month, last_day), tzinfo=timezone.utc)
    else:
        # Start this month
        start_date = datetime(now.year, now.month, re_data.day_of_month, tzinfo=timezone.utc)
        
    new_re = {
        'user_id': current_user.id,
        'amount': re_data.amount,
        'category': re_data.category,
        'description': re_data.description,
        'day_of_month': re_data.day_of_month,
        'total_months': re_data.total_months,
        'months_paid': 0,
        'next_deduction_date': start_date,
        'status': 'active',
        'created_at': now
    }
    
    update_time, doc_ref = db.collection('recurring_expenses').add(new_re)
    new_re['id'] = doc_ref.id
    return new_re

@router.get("/recurring", response_model=List[RecurringExpenseResponse])
def get_recurring_expenses(db: firestore.Client = Depends(database.get_db), current_user: User = Depends(get_current_user)):
    # Trigger processing first
    process_recurring_expenses(db, current_user.id)
    
    recurring_ref = db.collection('recurring_expenses').where('user_id', '==', current_user.id).stream()
    result = []
    for doc in recurring_ref:
        data = doc.to_dict()
        data['id'] = doc.id
        result.append(data)
    
    # Sort by created_at descending
    result.sort(key=lambda x: x.get('created_at', datetime.min.replace(tzinfo=timezone.utc)), reverse=True)
    return result
