from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime
import models, database
from auth import get_current_user

router = APIRouter()

# Schemas
class TransactionCreate(BaseModel):
    amount: float
    type: str # 'income' or 'expense'
    category: str
    description: Optional[str] = None

class TransactionResponse(BaseModel):
    id: int
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
    id: int
    limit_amount: float
    
    class Config:
        from_attributes = True

class AnalyticsSummary(BaseModel):
    total_income: float
    total_expenses: float
    expenses_by_category: Dict[str, float]

@router.post("/", response_model=TransactionResponse)
def add_transaction(transaction: TransactionCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if transaction.type not in ['income', 'expense']:
        raise HTTPException(status_code=400, detail="Invalid transaction type")
    
    new_transaction = models.Transaction(
        **transaction.model_dump(),
        user_id=current_user.id
    )
    db.add(new_transaction)
    db.commit()
    db.refresh(new_transaction)
    return new_transaction

@router.get("/", response_model=List[TransactionResponse])
def get_transactions(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Transaction).filter(models.Transaction.user_id == current_user.id).order_by(models.Transaction.date.desc()).all()

@router.post("/budget", response_model=BudgetResponse)
def set_budget(budget: BudgetCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_budget = db.query(models.Budget).filter(models.Budget.user_id == current_user.id).first()
    if db_budget:
        db_budget.limit_amount = budget.limit_amount
    else:
        db_budget = models.Budget(limit_amount=budget.limit_amount, user_id=current_user.id)
        db.add(db_budget)
    db.commit()
    db.refresh(db_budget)
    return db_budget

@router.get("/budget", response_model=Optional[BudgetResponse])
def get_budget(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Budget).filter(models.Budget.user_id == current_user.id).first()

@router.get("/analytics", response_model=AnalyticsSummary)
def get_analytics(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    transactions = db.query(models.Transaction).filter(models.Transaction.user_id == current_user.id).all()
    
    total_income = sum(t.amount for t in transactions if t.type == 'income')
    total_expenses = sum(t.amount for t in transactions if t.type == 'expense')
    
    expenses_by_category = {}
    for t in transactions:
        if t.type == 'expense':
            if t.category in expenses_by_category:
                expenses_by_category[t.category] += t.amount
            else:
                expenses_by_category[t.category] = t.amount
                
    return AnalyticsSummary(
        total_income=total_income,
        total_expenses=total_expenses,
        expenses_by_category=expenses_by_category
    )
