import hashlib
import os
import time
import uuid

import boto3
from botocore.exceptions import ClientError
from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware, AgentState
from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langgraph.store.base import BaseStore

from bedrock_agentcore.runtime import BedrockAgentCoreApp
from langgraph_checkpoint_aws import AgentCoreMemorySaver, AgentCoreMemoryStore
from faq_store import get_faq_store
from cache import get as cache_get, set as cache_set
from tools import get_weather_network_impact, get_country_info, validate_phone_number, check_public_holidays
from dotenv import load_dotenv

_ = load_dotenv()

app = BedrockAgentCoreApp()

REGION = os.getenv("AWS_REGION", "us-east-1")
MEMORY_ID = "agentcore_first_project-E1UsbWCIfu"

def _get_secret(secret_name: str) -> str:
    client = boto3.client("secretsmanager", region_name=REGION)
    return client.get_secret_value(SecretId=secret_name)["SecretString"]

try:
    OPENAI_API_KEY = _get_secret("lauki-phones/openai-api-key")
except Exception:
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

checkpointer = AgentCoreMemorySaver(memory_id=MEMORY_ID)
mem_store = AgentCoreMemoryStore(memory_id=MEMORY_ID)

_dynamo = None
def get_dynamo():
    global _dynamo
    if _dynamo is None:
        _dynamo = boto3.resource("dynamodb", region_name=REGION)
    return _dynamo


GUARDRAIL_ID = "fns2hq9ym7zf"
GUARDRAIL_VERSION = "2"

_bedrock_runtime = None
def get_bedrock_runtime():
    global _bedrock_runtime
    if _bedrock_runtime is None:
        _bedrock_runtime = boto3.client("bedrock-runtime", region_name=REGION)
    return _bedrock_runtime


def apply_guardrail(text: str) -> tuple[bool, str]:
    """Returns (blocked, message). If blocked=True, return message to user directly."""
    try:
        response = get_bedrock_runtime().apply_guardrail(
            guardrailIdentifier=GUARDRAIL_ID,
            guardrailVersion=GUARDRAIL_VERSION,
            source="INPUT",
            content=[{"text": {"text": text}}],
        )
        action = response.get("action", "NONE")
        if action == "GUARDRAIL_INTERVENED":
            outputs = response.get("outputs", [])
            msg = outputs[0].get("text", "I can only help with Lauki Phones telecom queries.") if outputs else "I can only help with Lauki Phones telecom queries."
            return True, msg
        return False, ""
    except Exception as e:
        print(f"Guardrail error (fail open): {e}")
        return False, ""

RATE_LIMIT = int(os.getenv("RATE_LIMIT_PER_HOUR", "20"))  # max requests per user per hour

def is_rate_limited(actor_id: str) -> bool:
    """Returns True if user has exceeded RATE_LIMIT requests in the last hour."""
    try:
        table = get_dynamo().Table("lauki-rate-limits")
        now = int(time.time())
        window_start = now - 3600

        item = table.get_item(Key={"actor_id": actor_id}).get("Item")
        if item:
            timestamps = [t for t in item.get("timestamps", []) if t > window_start]
            if len(timestamps) >= RATE_LIMIT:
                return True
            timestamps.append(now)
        else:
            timestamps = [now]

        table.put_item(Item={
            "actor_id": actor_id,
            "timestamps": timestamps,
            "ttl": now + 3600,
        })
        return False
    except ClientError:
        return False  # fail open — don't block users on DynamoDB errors




def get_user_profile(actor_id: str) -> dict:
    try:
        item = get_dynamo().Table("lauki-user-profiles").get_item(
            Key={"actor_id": actor_id}
        ).get("Item", {})
        return item
    except ClientError:
        return {}


def save_user_profile(actor_id: str, updates: dict) -> None:
    try:
        profile = get_user_profile(actor_id)
        profile.update(updates)
        profile["actor_id"] = actor_id
        profile["updated_at"] = int(time.time())
        get_dynamo().Table("lauki-user-profiles").put_item(Item=profile)
    except ClientError:
        pass


# ── FAQ gap detection ─────────────────────────────────────────────────────────

def log_faq_gap(question: str) -> None:
    """Log questions that had no good FAQ match for later review."""
    try:
        qhash = hashlib.sha256(question.strip().lower().encode()).hexdigest()
        get_dynamo().Table("lauki-faq-gaps").put_item(Item={
            "question_hash": qhash,
            "question": question,
            "count": 1,
            "first_seen": int(time.time()),
        })
    except ClientError:
        pass


# ── Sentiment detection ───────────────────────────────────────────────────────

FRUSTRATION_KEYWORDS = {
    "ridiculous", "unacceptable", "terrible", "worst", "useless",
    "fraud", "scam", "cheating", "disgusting", "pathetic",
    "not working", "still broken", "no response", "waiting days",
    "escalate", "complaint", "refund", "cancel", "legal"
}

def detect_frustration(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in FRUSTRATION_KEYWORDS)


# ── FAQ tools ─────────────────────────────────────────────────────────────────

@tool
def search_faq(query: str) -> str:
    """Search the Lauki Phones FAQ knowledge base for relevant information.
    Use for questions about plans, billing, network, devices, SIM, roaming, security.

    Args:
        query: The search query
    """
    results = get_faq_store().similarity_search(query, k=3)
    if not results:
        log_faq_gap(query)
        return "No relevant FAQ entries found. This question has been logged for review."

    # Log gap if top result score is low (no score available in basic search, use content length as proxy)
    context = "\n\n---\n\n".join(
        f"FAQ Entry {i+1}:\n{doc.page_content}" for i, doc in enumerate(results)
    )
    return f"Found {len(results)} relevant FAQ entries:\n\n{context}"


@tool
def search_detailed_faq(query: str, num_results: int = 5) -> str:
    """Search FAQ with more results for complex or multi-part questions.

    Args:
        query: The search query
        num_results: Number of results (default 5)
    """
    results = get_faq_store().similarity_search(query, k=num_results)
    if not results:
        log_faq_gap(query)
        return "No relevant FAQ entries found."
    context = "\n\n---\n\n".join(
        f"FAQ Entry {i+1}:\n{doc.page_content}" for i, doc in enumerate(results)
    )
    return f"Found {len(results)} detailed FAQ entries:\n\n{context}"


@tool
def reformulate_query(original_query: str, focus_aspect: str) -> str:
    """Reformulate query to focus on a specific aspect like pricing, activation, troubleshooting.

    Args:
        original_query: Original user question
        focus_aspect: Aspect to focus on (e.g., 'pricing', 'steps', 'eligibility')
    """
    results = get_faq_store().similarity_search(
        f"{focus_aspect} related to {original_query}", k=3
    )
    if not results:
        return f"No results found for aspect: {focus_aspect}"
    context = "\n\n---\n\n".join(
        f"Entry {i+1}:\n{doc.page_content}" for i, doc in enumerate(results)
    )
    return f"Results for '{focus_aspect}' aspect:\n\n{context}"


tools = [
    search_faq,
    search_detailed_faq,
    reformulate_query,
    get_weather_network_impact,
    get_country_info,
    validate_phone_number,
    check_public_holidays,
]


# ── Memory middleware ─────────────────────────────────────────────────────────

class MemoryMiddleware(AgentMiddleware):
    def pre_model_hook(self, state: AgentState, config: RunnableConfig, *, store: BaseStore):
        actor_id = config["configurable"]["actor_id"]
        thread_id = config["configurable"]["thread_id"]
        namespace = (actor_id, thread_id)
        messages = state.get("messages", [])
        # Trim to last 10 messages to stay within Groq's token limit
        if len(messages) > 10:
            messages = messages[-10:]

        for msg in reversed(messages):
            if isinstance(msg, HumanMessage):
                store.put(namespace, str(uuid.uuid4()), {"message": msg})

                # Inject user profile into context
                profile = get_user_profile(actor_id)
                if profile:
                    profile_info = ", ".join(
                        f"{k}: {v}" for k, v in profile.items()
                        if k not in ("actor_id", "updated_at")
                    )
                    messages = [SystemMessage(content=f"User profile: {profile_info}")] + list(messages)

                # Extract and save profile info from message
                content = msg.content.lower()
                updates = {}
                for plan in ["prepaid", "postpaid", "family plan", "enterprise", "data-only"]:
                    if plan in content:
                        updates["plan"] = plan
                for band in ["5g", "4g", "lte", "volte"]:
                    if band in content:
                        updates["network_preference"] = band.upper()
                if updates:
                    save_user_profile(actor_id, updates)
                break

        return {"messages": messages}

    def post_model_hook(self, state: AgentState, config: RunnableConfig, *, store: BaseStore):
        actor_id = config["configurable"]["actor_id"]
        thread_id = config["configurable"]["thread_id"]
        namespace = (actor_id, thread_id)
        for msg in reversed(state.get("messages", [])):
            if isinstance(msg, AIMessage):
                store.put(namespace, str(uuid.uuid4()), {"message": msg})
                break
        return state


# ── LLM + agent ───────────────────────────────────────────────────────────────

llm = init_chat_model(
    model="gpt-4o",
    model_provider="openai",
    api_key=OPENAI_API_KEY,
)

system_prompt = """You are a helpful customer support agent for Lauki Phones, an Indian telecom operator.

You have access to these tools — use them ONLY when relevant:
- search_faq: for ANY question about plans, billing, network, SIM, roaming, devices, security
- search_detailed_faq: only if search_faq didn't return enough information
- reformulate_query: only if the first search returned irrelevant results
- get_weather_network_impact: ONLY if user explicitly mentions signal/network issues AND provides a city
- get_country_info: ONLY if user explicitly mentions traveling to or calling a specific country
- validate_phone_number: ONLY if user provides a phone number for porting
- check_public_holidays: ONLY if user asks about support availability or billing timelines

Rules:
- Always start with search_faq
- Do NOT call weather, country, phone, or holiday tools unless the user's message clearly requires them
- Use the user's profile (plan, preferences) to personalize answers
- If frustrated tone detected, acknowledge empathetically and offer escalation
- Be concise and accurate"""

agent = create_agent(
    model=llm,
    tools=tools,
    checkpointer=checkpointer,
    store=mem_store,
    middleware=[MemoryMiddleware()],
    system_prompt=system_prompt,
)


# ── Entrypoint ────────────────────────────────────────────────────────────────

@app.entrypoint
def agent_invocation(payload, context):
    query = payload.get("prompt", "")
    actor_id = payload.get("actor_id", "default-user")
    thread_id = payload.get("thread_id", payload.get("session_id", "default-session"))

    # Rate limit check
    if is_rate_limited(actor_id):
        return {
            "error": "Rate limit exceeded. Maximum 20 requests per hour.",
            "actor_id": actor_id,
            "thread_id": thread_id,
        }

    # Guardrail check — block before hitting LLM
    blocked, block_msg = apply_guardrail(query)
    if blocked:
        return {"result": block_msg, "actor_id": actor_id, "thread_id": thread_id, "blocked": True}

    # Sentiment check — bypass cache for frustrated users, flag for escalation
    frustrated = detect_frustration(query)

    # Cache check (skip for frustrated users — they need fresh, empathetic response)
    if not frustrated:
        cached = cache_get(query)
        if cached:
            return {"result": cached, "actor_id": actor_id, "thread_id": thread_id, "cached": True}

    config = {"configurable": {"thread_id": thread_id, "actor_id": actor_id}}
    result = agent.invoke({"messages": [("human", query)]}, config=config)

    messages = result.get("messages", [])
    answer = messages[-1].content if messages else "No response generated"

    tool_calls_used = [
        msg.tool_calls[0]["name"]
        for msg in messages
        if hasattr(msg, "tool_calls") and msg.tool_calls
    ]

    # Append escalation offer for frustrated users
    if frustrated:
        answer += "\n\n---\n⚠️ I can see you're frustrated. Would you like me to raise an escalation ticket for priority support?"

    if not frustrated:
        cache_set(query, answer)

    return {
        "result": answer,
        "actor_id": actor_id,
        "thread_id": thread_id,
        "escalation_flagged": frustrated,
        "tools_used": tool_calls_used,
        "blocked": False,
    }


if __name__ == "__main__":
    app.run()
