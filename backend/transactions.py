from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime, timezone
import re
import io
import PyPDF2
from google.cloud import firestore
import database
from auth import get_current_user, User

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
    transactions_ref = db.collection('transactions').where('user_id', '==', current_user.id).order_by('date', direction=firestore.Query.DESCENDING).stream()
    
    transactions = []
    for doc in transactions_ref:
        data = doc.to_dict()
        data['id'] = doc.id
        transactions.append(data)
        
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
def get_analytics(db: firestore.Client = Depends(database.get_db), current_user: User = Depends(get_current_user)):
    transactions_ref = db.collection('transactions').where('user_id', '==', current_user.id).stream()
    
    total_income = 0.0
    total_expenses = 0.0
    expenses_by_category = {}
    
    for doc in transactions_ref:
        t = doc.to_dict()
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
                
    return AnalyticsSummary(
        total_income=total_income,
        total_expenses=total_expenses,
        expenses_by_category=expenses_by_category
    )

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
