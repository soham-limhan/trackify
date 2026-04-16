import httpx
import json
import logging
from pydantic import BaseModel, Field
from typing import List, Optional
import os
from datetime import datetime

# Configure logging
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

# Environment variables for configuration
OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://localhost:11434/api/generate")
MODEL_NAME = os.getenv("OLLAMA_MODEL_NAME", "financialadvisor")

async def get_ai_financial_advice(transactions_data: List[dict], user_query: Optional[str] = None) -> Optional[FinancialAdviceSchema]:
    """
    Sends transaction data to the local 'financialadvisor' LLM and parses the JSON response.
    Optional user_query allows for specific financial questions or goals.
    """
    if not transactions_data:
        return None

    # Limit to most recent 50 transactions to keep context window manageable
    recent_transactions = sorted(
        transactions_data, 
        key=lambda x: x.get('date', datetime.min), 
        reverse=True
    )[:50]

    trans_text = []
    for t in recent_transactions:
        # Convert date if it's a datetime object
        dt = t.get('date')
        date_str = dt.strftime('%Y-%m-%d') if isinstance(dt, datetime) else str(dt)
        t_type = t.get('type', 'expense')
        amount = t.get('amount', 0)
        cat = t.get('category', 'Other')
        desc = t.get('description', '')
        trans_text.append(f"{date_str}: {t_type} ₹{amount} ({cat} - {desc})")

    query_section = f"""
    CRITICAL: The user has a specific request/goal:
    "{user_query}"
    You MUST address this request directly in your 'summary' and 'key_insights'.
    """ if user_query else ""

    prompt = f"""
    You are an expert financial advisor named "Trackify AI". 
    Analyze the user's spending patterns and answer their specific questions.

    {query_section}
    
    RESPONSE RULES:
    1. EXCLUSIVELY return a JSON object.
    2. Format must precisely match this schema:
    {{
      "summary": "Directly answer the user's query and summarize their health.",
      "key_insights": [
        {{ "category": "Category name", "action": "Specific recommendation answering their goal", "priority": "High/Medium/Low" }}
      ],
      "savings_tips": ["Practical tips to help achieve their specific goal."],
      "risk_alerts": ["Potential issues related to their goal or general spending."]
    }}

    USER TRANSACTIONS (Recent History):
    {chr(10).join(trans_text)}

    FINAL REMINDER: If the user asked about a specific purchase or goal (like "{user_query}"), ensure your advice tells them if they can afford it based on the data above.
    """

    raw_response_text = ""
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            logger.info(f"Generating AI advice for query: {user_query}")
            # Log the prompt for debugging
            logger.debug(f"Full Prompt: {prompt}")
            
            response = await client.post(
                OLLAMA_API_URL,
                json={
                    "model": MODEL_NAME,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json"
                }
            )
            
            if response.status_code != 200:
                logger.error(f"Ollama API error: {response.status_code} - {response.text}")
                return None
                
            result = response.json()
            raw_response_text = result.get("response", "{}")
            logger.info(f"Raw LLM Response: {raw_response_text}")
            
            # Parse the inner JSON string returned by Ollama
            parsed_json = json.loads(raw_response_text)
            
            # Ensure required keys exist
            for key in ["summary", "key_insights", "savings_tips", "risk_alerts"]:
                if key not in parsed_json:
                    parsed_json[key] = "N/A" if key == "summary" else []

            # Validate with Pydantic
            return FinancialAdviceSchema(**parsed_json)

    except httpx.TimeoutException:
        logger.error(f"Ollama API timed out after 300 seconds for query: {user_query}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM JSON response: {e}. Raw response: {raw_response_text[:200]}...")
        return None
    except Exception as e:
        logger.exception(f"Unexpected error in AI Advisor service: {e}")
        return None
