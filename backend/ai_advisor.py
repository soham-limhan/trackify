import httpx
import json
import logging
from pydantic import BaseModel
from typing import List, Optional, AsyncGenerator
import os
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class Insight(BaseModel):
    category: str
    action: str
    priority: str  # High, Medium, Low


class FinancialAdviceSchema(BaseModel):
    summary: str
    key_insights: List[Insight]
    savings_tips: List[str]
    risk_alerts: List[str]


OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://localhost:11434/api/generate")
MODEL_NAME = os.getenv("OLLAMA_MODEL_NAME", "financialadvisor")


def _build_prompt(transactions_data: List[dict], user_query: Optional[str] = None) -> str:
    """Build a rich, explicit prompt with pre-computed variables — no complex inline expressions."""

    # ── Aggregate numbers ────────────────────────────────────────────────────
    total_income  = sum(t.get("amount", 0) for t in transactions_data if t.get("type") == "income")
    total_expense = sum(t.get("amount", 0) for t in transactions_data if t.get("type") == "expense")
    net_savings   = total_income - total_expense
    savings_rate  = round(net_savings / total_income * 100, 1) if total_income > 0 else 0.0
    expense_ratio = round(total_expense / total_income * 100, 1) if total_income > 0 else 0.0

    # ── Savings health label ─────────────────────────────────────────────────
    if savings_rate >= 30:
        savings_health = "excellent — well above the 30% benchmark"
    elif savings_rate >= 20:
        savings_health = "good — meets the 20% recommended minimum"
    elif savings_rate >= 10:
        savings_health = "moderate — below the recommended 20% target"
    else:
        savings_health = "critical — you are saving very little of your income"

    # ── Category breakdown ───────────────────────────────────────────────────
    categories: dict = {}
    for t in transactions_data:
        if t.get("type") == "expense":
            cat = t.get("category", "Other")
            categories[cat] = categories.get(cat, 0) + t.get("amount", 0)

    top_cats = sorted(categories.items(), key=lambda x: x[1], reverse=True)[:6]

    if total_expense > 0 and top_cats:
        cats_lines = "\n".join(
            f"  {i+1}. {k}: Rs.{v:,.0f}  ({v / total_expense * 100:.1f}% of expenses)"
            for i, (k, v) in enumerate(top_cats)
        )
    else:
        cats_lines = "  No expense data available."

    # ── Recent transactions ──────────────────────────────────────────────────
    recent = sorted(transactions_data, key=lambda x: x.get("date", datetime.min), reverse=True)[:20]
    trans_lines = []
    for t in recent:
        dt = t.get("date")
        date_str = dt.strftime("%Y-%m-%d") if isinstance(dt, datetime) else str(dt)[:10]
        desc = (t.get("description") or "")[:35]
        trans_lines.append(
            f"  {date_str} | {t.get('type','?'):7} | Rs.{t.get('amount', 0):>9,.0f}"
            f" | {t.get('category','Other'):<18} | {desc}"
        )
    trans_block = "\n".join(trans_lines) if trans_lines else "  No transactions."

    # ── Example values (pre-computed, never inside the f-string) ────────────
    top_cat_name  = top_cats[0][0] if top_cats else "General"
    top_cat_amt   = top_cats[0][1] if top_cats else 0
    top_cat_pct   = round(top_cat_amt / total_expense * 100, 1) if total_expense > 0 else 0
    reduce_15pct  = round(top_cat_amt * 0.15)
    monthly_save  = round(total_income * 0.20)
    rate_verb     = "exceeds" if savings_rate >= 20 else "falls short of"
    emergency_amt = round(total_expense / 6) if total_expense > 0 else 0

    if expense_ratio > 70:
        risk_example = (
            f"Expense-to-income ratio is {expense_ratio}% — only {round(100-expense_ratio)}% "
            f"buffer left. Any unexpected cost could strain finances."
        )
    else:
        risk_example = (
            f"Expense ratio of {expense_ratio}% is manageable, but monitor {top_cat_name} "
            f"closely to prevent overspend."
        )

    query_section = (
        f'\nUSER QUESTION: "{user_query}"\n'
        f'You MUST directly and specifically answer this question in your insights.\n'
    ) if user_query else ""

    # ── Final prompt ─────────────────────────────────────────────────────────
    prompt = (
        f"You are Trackify AI, a smart personal financial advisor.{query_section}\n"
        f"Analyze the financial data below. Output ONLY a single JSON object — "
        f"no markdown, no code blocks, no extra text.\n\n"
        f"=== USER FINANCIAL DATA ===\n"
        f"Total income (all time) : Rs.{total_income:,.0f}\n"
        f"Total expenses (all time): Rs.{total_expense:,.0f}\n"
        f"Net savings             : Rs.{net_savings:,.0f}\n"
        f"Savings rate            : {savings_rate}%  ({savings_health})\n"
        f"Expense-to-income ratio : {expense_ratio}%\n\n"
        f"Spending by category:\n{cats_lines}\n\n"
        f"Recent 20 transactions (newest first):\n{trans_block}\n\n"
        f"=== OUTPUT RULES ===\n"
        f"1. Return ONLY valid JSON. No text before or after.\n"
        f'2. "summary" MUST be a plain English string of 2-3 sentences. '
        f"NEVER an object, array, or nested JSON.\n"
        f'3. "key_insights" MUST be an array of objects, each with:\n'
        f'   - "category": string (e.g. "Savings Rate", "Food", "Transfer")\n'
        f'   - "action": specific advice referencing actual Rs. amounts or %\n'
        f'   - "priority": exactly "High", "Medium", or "Low"\n'
        f'4. "savings_tips" MUST be an array of plain English strings.\n'
        f'5. "risk_alerts" MUST be an array of plain English strings.\n'
        f"6. Provide 4-5 key_insights, 3-4 savings_tips, and 2-3 risk_alerts.\n\n"
        f"=== EXAMPLE OUTPUT (follow this structure exactly) ===\n"
        f'{{"summary": "Your savings rate is {savings_rate}% which is {savings_health}. '
        f"You have saved Rs.{net_savings:,.0f} total with Rs.{total_expense:,.0f} spent. "
        f'{top_cat_name} is your largest expense at Rs.{top_cat_amt:,.0f} ({top_cat_pct}% of spending).", '
        f'"key_insights": ['
        f'{{"category": "Savings Rate", "action": "Your {savings_rate}% savings rate {rate_verb} the recommended 20% goal. '
        f'Aim to save Rs.{monthly_save:,.0f} per month.", "priority": "{"Low" if savings_rate >= 20 else "High"}"}},'
        f'{{"category": "{top_cat_name}", "action": "Rs.{top_cat_amt:,.0f} spent on {top_cat_name} ({top_cat_pct}% of expenses). '
        f'Reducing by 15% would save Rs.{reduce_15pct:,.0f}.", "priority": "High"}},'
        f'{{"category": "Emergency Fund", "action": "Build a 3-month expense buffer of Rs.{emergency_amt:,.0f} '
        f'before increasing discretionary spending.", "priority": "Medium"}}'
        f'], '
        f'"savings_tips": ['
        f'"Auto-transfer Rs.{monthly_save:,.0f} to savings on salary day",'
        f'"Reduce {top_cat_name} spend by 10% to free Rs.{round(top_cat_amt*0.1):,.0f} monthly",'
        f'"Track every expense for 30 days to spot hidden leaks"'
        f'], '
        f'"risk_alerts": ['
        f'"{risk_example}",'
        f'"No documented budget means spending can creep up silently — set monthly caps per category"'
        f']}}\n\n'
        f"Now produce the real analysis based ONLY on the actual data provided above:"
    )
    return prompt


async def keep_model_warm() -> bool:
    """Sends a minimal request to load the model into memory."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                OLLAMA_API_URL,
                json={"model": MODEL_NAME, "prompt": "hi", "stream": False, "options": {"num_predict": 1}}
            )
            warmed = response.status_code == 200
            logger.info(f"Model warm-up {'succeeded' if warmed else 'failed'}: {response.status_code}")
            return warmed
    except Exception as e:
        logger.warning(f"Model warm-up skipped (Ollama not reachable): {e}")
        return False


async def get_ai_financial_advice(
    transactions_data: List[dict], user_query: Optional[str] = None
) -> Optional[FinancialAdviceSchema]:
    """Non-streaming path — returns a parsed FinancialAdviceSchema."""
    if not transactions_data:
        return None

    prompt = _build_prompt(transactions_data, user_query)
    raw_response_text = ""
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            logger.info(f"Generating AI advice for query: {user_query}")
            response = await client.post(
                OLLAMA_API_URL,
                json={"model": MODEL_NAME, "prompt": prompt, "stream": False, "format": "json"}
            )
            if response.status_code != 200:
                logger.error(f"Ollama API error: {response.status_code} - {response.text}")
                return None

            result = response.json()
            raw_response_text = result.get("response", "{}")
            logger.info(f"Raw LLM Response: {raw_response_text}")
            parsed_json = json.loads(raw_response_text)

            for key in ["summary", "key_insights", "savings_tips", "risk_alerts"]:
                if key not in parsed_json:
                    parsed_json[key] = "N/A" if key == "summary" else []

            return FinancialAdviceSchema(**parsed_json)

    except httpx.TimeoutException:
        logger.error(f"Ollama API timed out for query: {user_query}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM JSON: {e}. Raw: {raw_response_text[:200]}...")
        return None
    except Exception as e:
        logger.exception(f"Unexpected error in AI Advisor: {e}")
        return None


async def stream_ai_financial_advice(
    transactions_data: List[dict],
    user_query: Optional[str] = None
) -> AsyncGenerator[str, None]:
    """Streaming path — yields SSE events."""
    if not transactions_data:
        yield "data: [ERROR] No transactions found\n\n"
        return

    prompt = _build_prompt(transactions_data, user_query)

    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            logger.info(f"Streaming AI advice for query: {user_query}")
            async with client.stream(
                "POST", OLLAMA_API_URL,
                json={"model": MODEL_NAME, "prompt": prompt, "stream": True, "format": "json"}
            ) as response:
                if response.status_code != 200:
                    yield f"data: [ERROR] Ollama returned {response.status_code}\n\n"
                    return

                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                        token = chunk.get("response", "")
                        if token:
                            safe_token = token.replace("\n", "\\n")
                            yield f"data: {safe_token}\n\n"
                        if chunk.get("done", False):
                            yield "data: [DONE]\n\n"
                            return
                    except json.JSONDecodeError:
                        continue

    except httpx.TimeoutException:
        logger.error("Streaming AI advisor timed out")
        yield "data: [ERROR] Request timed out — is Ollama running?\n\n"
    except Exception as e:
        logger.exception(f"Unexpected streaming error: {e}")
        yield f"data: [ERROR] {str(e)}\n\n"
