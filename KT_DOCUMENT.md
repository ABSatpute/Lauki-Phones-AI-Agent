# Knowledge Transfer Document
## Lauki Phones AI Agent — Production Telecom Support System

| Field | Details |
|---|---|
| **Project Name** | Lauki Phones AI Agent |
| **Repository** | https://github.com/ABSatpute/Lauki-Phones-AI-Agent |
| **AWS Account** | YOUR_ACCOUNT_ID (us-east-1) |
| **Backend** | Amazon Bedrock AgentCore — `Agent_with_memory-96lnExBamr` |
| **Frontend** | Vercel (auto-deploys on push to `main`) |
| **Document Date** | May 2026 |
| **Status** | Production |

---

## 1. Project Overview

### 1.1 What It Does

Lauki Phones AI Agent is a production telecom customer support agent for a fictional Indian carrier. It answers customer questions 24/7 about plans, billing, network issues, SIM management, international roaming, device compatibility, and account management — without human intervention.

### 1.2 Key Capabilities

| Capability | How It Works |
|---|---|
| FAQ answering | FAISS vector search over 75 Q&A pairs in `lauki_qna.csv` |
| Personalization | User plan/preferences stored in DynamoDB, injected into LLM context |
| Short-term memory | Full conversation history per session (AgentCoreMemorySaver) |
| Long-term memory | User profile persists across sessions (AgentCoreMemoryStore) |
| Real-time enrichment | 4 free external APIs: weather, country info, phone validation, holidays |
| Content safety | AWS Bedrock Guardrails v2: hate, violence, PII, prompt injection |
| Response caching | DynamoDB 24h TTL — repeated questions answered instantly, no LLM cost |
| FAISS index caching | S3 — zero Bedrock embedding calls on cold start |
| Rate limiting | 20 requests/hour/user via DynamoDB sliding window |
| Sentiment detection | Keyword matching → empathetic response + escalation offer |
| FAQ gap detection | Unanswered questions logged to DynamoDB for knowledge base improvement |

---

## 2. Technology Stack

### 2.1 Backend Technologies

| Technology | Version | Role |
|---|---|---|
| **Python** | 3.13+ | Runtime language |
| **Amazon Bedrock AgentCore** | Latest | Managed serverless agent hosting platform (ARM64) |
| **LangGraph** | 1.2.0 | ReAct agent orchestration framework |
| **LangChain** | 1.3.1 | LLM abstraction layer, tool framework, middleware |
| **OpenAI GPT-4o** | Latest | Primary LLM for reasoning and response generation |
| **Bedrock Titan Embeddings v2** | `amazon.titan-embed-text-v2:0` | Converts FAQ text to vectors for similarity search |
| **FAISS** | 1.13.2 | In-memory vector similarity search engine |
| **AWS Bedrock Guardrails** | v2 (`fns2hq9ym7zf`) | Content safety: hate, violence, sexual content, PII, prompt injection |
| **AgentCore Memory** | STM + LTM | Conversation history + user profile persistence |
| **Amazon DynamoDB** | PAY_PER_REQUEST | 4 tables: cache, rate limits, user profiles, FAQ gaps |
| **Amazon S3** | Standard | FAISS index persistence across cold starts |
| **AWS Secrets Manager** | — | Secure API key storage (OpenAI, Groq) |
| **uv** | Latest | Fast Python package manager |

### 2.2 Frontend Technologies

| Technology | Version | Role |
|---|---|---|
| **Next.js** | 16.2.6 | React framework with server-side API routes |
| **TypeScript** | 5.x | Type safety across all components |
| **Tailwind CSS v4** | Latest | Utility-first CSS (CSS-first config, no tailwind.config.ts) |
| **shadcn/ui** | Latest | Accessible UI components (Button, Input, Badge, ScrollArea, etc.) |
| **Zustand** | Latest | Client-side state management, persisted to localStorage |
| **react-markdown + remark-gfm** | Latest | Renders agent responses as formatted markdown with tables |
| **aws4** | Latest | AWS SigV4 request signing (server-side only) |
| **date-fns** | Latest | Relative timestamps in sidebar ("2 minutes ago") |
| **lucide-react** | Latest | Icon library |
| **Vercel** | — | Hosting, CI/CD, preview deployments per PR |

### 2.3 AWS Infrastructure

| Service | Purpose |
|---|---|
| **Bedrock AgentCore Runtime** | Serverless ARM64 container hosting |
| **AWS CodeBuild** | Cross-platform ARM64 Docker image builds (no local Docker needed) |
| **Amazon ECR** | Docker image registry |
| **AWS CloudWatch Logs** | Runtime logs, error tracking |
| **AWS X-Ray** | Distributed tracing, latency analysis |
| **AWS IAM** | Role-based access control for all services |

---

## 3. System Architecture

### 3.1 Full Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER LAYER                               │
│  Any browser → Vercel Frontend (Next.js 16, React)              │
│  URL: https://your-app.vercel.app                               │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTPS POST /api/chat
                           │ Body: { prompt, actorId, threadId }
┌──────────────────────────▼───────────────────────────────────────┐
│                      GATEWAY LAYER                               │
│  Next.js API Route (server-side, Vercel Edge)                   │
│  - Validates input                                               │
│  - Signs request with AWS SigV4 (aws4 library)                  │
│  - Proxies to AgentCore (AWS credentials never in browser)      │
└──────────────────────────┬───────────────────────────────────────┘
                           │ SigV4-signed HTTPS
                           │ bedrock-agentcore.us-east-1.amazonaws.com
┌──────────────────────────▼───────────────────────────────────────┐
│           AMAZON BEDROCK AGENTCORE RUNTIME                       │
│  Container: ARM64, Python 3.14, Public Network                  │
│  Idle Timeout: 300s | Memory: STM+LTM enabled                   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  agent_invocation(payload, context)  [@app.entrypoint]    │  │
│  │                                                            │  │
│  │  1. Rate Limit Check ──────────────→ DynamoDB             │  │
│  │  2. Guardrail Check ───────────────→ Bedrock API          │  │
│  │  3. Sentiment Detection ───────────→ Keyword matching     │  │
│  │  4. Cache Lookup ──────────────────→ DynamoDB             │  │
│  │  5. LangGraph Agent ───────────────→ GPT-4o + Tools       │  │
│  │  6. Cache Write ───────────────────→ DynamoDB             │  │
│  │  7. Return Response                                        │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┬──────────────────┐
          ▼                ▼                ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  S3 Bucket   │  │  AgentCore   │  │  DynamoDB    │  │  External    │
│  FAISS Index │  │  Memory      │  │  4 Tables    │  │  APIs (Free) │
│  (S3 cached) │  │  STM + LTM   │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

### 3.2 LangGraph ReAct Agent Loop

```
User Query
    │
    ▼
[THINK] GPT-4o reads system prompt + conversation history
    │    Decides: which tool to call? what arguments?
    ▼
[ACT] Tool executes (FAISS search / API call)
    │
    ▼
[OBSERVE] GPT-4o reads tool output
    │
    ▼
[THINK] Is more information needed?
    │    Yes → loop back to ACT
    │    No  → generate final answer
    ▼
[ANSWER] Final response to user
```

---

## 4. Complete Request Lifecycle

### 4.1 Step-by-Step Flow

```
Step 1: User Input
  Browser → ChatPanel.tsx → fetch POST /api/chat
  Body: { prompt: "how to activate roaming?",
          actorId: "uuid-per-browser",
          threadId: "uuid-per-session" }

Step 2: Next.js API Route (app/api/chat/route.ts)
  - Validates prompt is not empty
  - Signs request with AWS SigV4 using aws4 library
  - POST to: https://bedrock-agentcore.us-east-1.amazonaws.com
             /runtimes/{URL-encoded-ARN}/invocations
  - Headers: Authorization (SigV4), Content-Type: application/json,
             X-Amzn-Bedrock-AgentCore-Runtime-Session-Id: {threadId}

Step 3: AgentCore Runtime
  - Routes to running container OR cold-starts new one
  - Calls agent_invocation(payload, context)
  - payload = { prompt, actor_id, thread_id }

Step 4: Rate Limit Check (is_rate_limited)
  - Table: lauki-rate-limits, Key: actor_id
  - Sliding window: filter timestamps > (now - 3600s)
  - If count >= RATE_LIMIT (default 20): return error
  - Else: append current timestamp, save back to DynamoDB
  - TTL: 1 hour (auto-cleanup)
  - Fails OPEN: DynamoDB errors don't block users

Step 5: Guardrail Check (apply_guardrail)
  - Calls Bedrock bedrock-runtime.apply_guardrail()
  - Guardrail: fns2hq9ym7zf, Version: 2
  - Checks: SEXUAL(HIGH), VIOLENCE(MEDIUM), HATE(MEDIUM),
            INSULTS(LOW), MISCONDUCT(MEDIUM), PROMPT_ATTACK(HIGH)
  - PII: EMAIL(ANONYMIZE), PHONE(ANONYMIZE), CREDIT_CARD(BLOCK)
  - If action == "GUARDRAIL_INTERVENED": return blocked message
  - Fails OPEN: API errors don't block users

Step 6: Sentiment Detection (detect_frustration)
  - Keyword set: "ridiculous", "fraud", "scam", "terrible", etc.
  - If match: frustrated = True
  - Frustrated users: skip cache, get fresh empathetic response

Step 7: Cache Check (cache.get)
  - Table: faq-response-cache
  - Key: SHA-256(query.strip().lower())
  - If hit AND TTL > now: return cached answer immediately
    Response includes "cached": true
  - If miss: continue to agent

Step 8: LangGraph Agent (agent.invoke)
  - MemoryMiddleware.pre_model_hook runs first:
    a. Trim messages to last 10 (token limit protection)
    b. Save human message to LTM (AgentCoreMemoryStore)
    c. Load user profile from DynamoDB
    d. Inject profile as SystemMessage if exists
    e. Auto-detect plan/network from message, save to profile
  - GPT-4o runs ReAct loop with 7 available tools
  - MemoryMiddleware.post_model_hook runs after:
    a. Save AI response to LTM

Step 9: Response Assembly
  - Extract answer from last AIMessage
  - Collect tool_calls_used list
  - If frustrated: append escalation offer to answer
  - If not frustrated: write to cache (24h TTL)
  - Return full response object

Step 10: Frontend Rendering
  - ChatPanel.tsx receives response
  - Adds message to Zustand store (persisted to localStorage)
  - MessageBubble.tsx renders markdown with react-markdown
  - Shows tool badges, cached indicator, escalation flag
```

### 4.2 Response Object Structure

```json
{
  "result": "Markdown-formatted answer...",
  "actor_id": "default-user",
  "thread_id": "default-session",
  "tools_used": ["search_faq", "get_country_info"],
  "cached": false,
  "escalation_flagged": false,
  "blocked": false
}
```

### 4.3 Cold Start Sequence (~15-20 seconds)

```
1. AgentCore starts ARM64 container
2. Python runtime initializes
3. All imports execute (LangGraph, LangChain, boto3, etc.)
4. BedrockEmbeddings client initialized
5. Secrets Manager: fetch OpenAI API key
6. AgentCoreMemorySaver + AgentCoreMemoryStore initialized
7. DynamoDB resource initialized (lazy)
8. Bedrock runtime client initialized (lazy)
9. LangGraph agent created with tools + middleware
10. First request: FAISS index downloaded from S3 (~2-3s)
11. Request processed normally
```


---

## 5. Backend — Detailed Component Guide

### 5.1 `02_agentcore_memory.py` — Main Agent

**Entry point:** `agent_invocation(payload, context)` decorated with `@app.entrypoint`

**Module-level initialization (runs once per container lifetime):**
```python
app = BedrockAgentCoreApp()          # AgentCore runtime wrapper
OPENAI_API_KEY = _get_secret(...)    # Fetched from Secrets Manager
checkpointer = AgentCoreMemorySaver(memory_id=MEMORY_ID)  # STM
mem_store = AgentCoreMemoryStore(memory_id=MEMORY_ID)     # LTM
llm = init_chat_model("gpt-4o", ...)  # GPT-4o client
agent = create_agent(model, tools, checkpointer, store, middleware, system_prompt)
```

**Key configuration constants:**
```python
REGION = "us-east-1"
MEMORY_ID = "agentcore_first_project-E1UsbWCIfu"
GUARDRAIL_ID = "fns2hq9ym7zf"
GUARDRAIL_VERSION = "2"
RATE_LIMIT = 20  # override: RATE_LIMIT_PER_HOUR env var
```

**System prompt (controls agent behavior):**
The system prompt tells GPT-4o:
- Always start with `search_faq`
- Only call weather/country/phone/holiday tools when explicitly relevant
- Use user profile to personalize answers
- Acknowledge frustration empathetically

**MemoryMiddleware hooks:**
- `pre_model_hook`: runs before each LLM call — trims history, injects profile, saves human message to LTM
- `post_model_hook`: runs after each LLM call — saves AI response to LTM

**User profile auto-detection:**
If user mentions "postpaid", "5G", "prepaid", etc. in any message, it's automatically extracted and saved to `lauki-user-profiles` DynamoDB table. On next request, it's injected as a SystemMessage so GPT-4o can personalize answers.

### 5.2 `faq_store.py` — Vector Store with S3 Cache

**Purpose:** Loads `lauki_qna.csv` into FAISS using Bedrock Titan Embeddings. Caches the built index to S3 to avoid rebuilding on every cold start.

**S3 cache logic:**
```
On get_faq_store() call:
  1. Check S3 for faq-index/index.faiss
  2. If exists → download index.faiss + index.pkl → load FAISS
  3. If not → read CSV → chunk (500 chars) → embed with Titan → build FAISS
             → save locally → upload to S3 → return store
```

**Configuration:**
```python
S3_BUCKET = f"bedrock-agentcore-faq-index-{ACCOUNT_ID}"
S3_PREFIX = "faq-index"
CSV_PATH = "./lauki_qna.csv"  # override: FAQ_CSV_PATH env var
```

**To update the knowledge base:**
1. Edit `lauki_qna.csv`
2. Delete S3 cache: `aws s3 rm s3://bedrock-agentcore-faq-index-YOUR_ACCOUNT_ID/faq-index/ --recursive`
3. Deploy — new index builds on first invocation

**CSV format:**
```csv
question,answer
"How do I activate roaming?","Purchase a region-specific pack..."
```

### 5.3 `cache.py` — DynamoDB Response Cache

**Table:** `faq-response-cache`  
**Key:** `question_hash` = SHA-256(query.strip().lower())  
**TTL field:** `ttl` = Unix timestamp + 86400 (24h)  
**Behavior:** Fails silently — cache errors never block the agent

**When cache is bypassed:**
- Frustrated users (sentiment detected)
- Blocked responses (guardrail intervened)

**Cache invalidation:**
- Automatic: DynamoDB TTL expires items after 24h
- Manual: Delete table and recreate, or delete specific items

### 5.4 `tools.py` — External API Tools

#### `search_faq(query)`
- Calls `get_faq_store().similarity_search(query, k=3)`
- Returns top 3 FAQ entries
- If no results: logs to `lauki-faq-gaps` table

#### `search_detailed_faq(query, num_results=5)`
- Same as above but returns up to 5 results
- Used when initial search is insufficient

#### `reformulate_query(original_query, focus_aspect)`
- Reformulates as `"{focus_aspect} related to {original_query}"`
- Searches FAISS with reformulated query
- Used when initial search returns irrelevant results

#### `get_weather_network_impact(city)`
- Step 1: Geocoding API → lat/lon for city name
- Step 2: Open-Meteo forecast API → current weather
- Maps WMO weather codes to network impact levels
- API: `https://api.open-meteo.com` (free, no key)

#### `get_country_info(country_name)`
- Fetches: name, dial code, currency, region, timezones
- API: `https://restcountries.com/v3.1/name/{name}` (free, no key)

#### `validate_phone_number(phone_number, country_code="IN")`
- Tries Abstract API (free tier, may fail)
- Falls back to digit count validation
- Returns: valid/invalid, carrier, line type

#### `check_public_holidays(country_code, year=2026)`
- Fetches upcoming holidays for country
- API: `https://date.nager.at/api/v3/PublicHolidays/{year}/{code}` (free, no key)
- Returns next 3 upcoming holidays with SLA note

---

## 6. Frontend — Detailed Component Guide

### 6.1 `app/api/chat/route.ts` — AgentCore Proxy

**Why it exists:** AWS credentials must never be in the browser. This server-side route holds credentials and signs requests.

**Request signing:**
```typescript
const opts = aws4.sign({
  host: "bedrock-agentcore.us-east-1.amazonaws.com",
  path: `/runtimes/${ENCODED_ARN}/invocations`,
  method: "POST",
  headers: { "Content-Type": "application/json",
             "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id": threadId },
  body: JSON.stringify({ prompt, actor_id, thread_id }),
  service: "bedrock-agentcore",
  region: "us-east-1",
}, { accessKeyId, secretAccessKey, sessionToken })
```

**Error handling:** Returns HTTP status from AgentCore with error message in body.

### 6.2 `store/chat.ts` — Zustand State

**Persisted to localStorage** as `lauki-chat-store`.

**State shape:**
```typescript
{
  user: { name: string, actorId: string },  // actorId = UUID, generated once
  sessions: Session[],                       // all conversations
  activeSessionId: string,                   // currently open session
  sidebarOpen: boolean
}
```

**Session auto-title:** First user message (truncated to 40 chars) becomes session title.

**actorId:** Generated once per browser install, used as LTM key. All sessions from same browser share the same LTM profile.

### 6.3 `components/Sidebar.tsx`

- Lists all sessions with relative timestamps
- "New conversation" button creates fresh session
- Delete button (hover to reveal) removes session
- User name editor (click ⚙ icon)
- Collapse/expand with chevron button
- Active session highlighted in emerald green

### 6.4 `components/ChatPanel.tsx`

- Auto-scrolls to bottom on new messages
- Textarea auto-resizes (1 line to 8 lines max)
- Enter to send, Shift+Enter for newline
- Suggestion chips shown on empty sessions
- Resets input and loading state on session change

### 6.5 `components/MessageBubble.tsx`

- User messages: dark gray bubble, right-aligned
- Agent messages: white bubble with border, left-aligned
- Markdown rendered with `react-markdown` + `remark-gfm`
- Tables: styled with borders, alternating row colors
- Code: monospace with gray background
- Copy button: appears on hover, shows checkmark on copy
- Badges: tool names, "Cached" (⚡), "Escalated" (⚠️)
- Timestamps: `suppressHydrationWarning` to avoid SSR mismatch

---

## 7. AWS Infrastructure

### 7.1 All Resources

| Resource | Name/ID | Tags |
|---|---|---|
| AgentCore Runtime | `Agent_with_memory-96lnExBamr` | project=lauki-phones, env=production |
| AgentCore Memory | `agentcore_first_project-E1UsbWCIfu` | project=lauki-phones, env=production |
| ECR Repository | `bedrock-agentcore-agent_with_memory` | project=lauki-phones, env=production |
| S3 Bucket | `bedrock-agentcore-faq-index-YOUR_ACCOUNT_ID` | project=lauki-phones, env=production |
| DynamoDB | `faq-response-cache` | project=lauki-phones, env=production |
| DynamoDB | `lauki-user-profiles` | project=lauki-phones, env=production |
| DynamoDB | `lauki-faq-gaps` | project=lauki-phones, env=production |
| DynamoDB | `lauki-rate-limits` | project=lauki-phones, env=production |
| Secrets Manager | `lauki-phones/openai-api-key` | project=lauki-phones, env=production |
| Secrets Manager | `lauki-phones/groq-api-key` | project=lauki-phones, env=production |
| Bedrock Guardrail | `fns2hq9ym7zf` v2 | project=lauki-phones, env=production |
| IAM Role (Runtime) | `AmazonBedrockAgentCoreSDKRuntime-us-east-1-ab7e989caa` | — |
| IAM Role (Build) | `AmazonBedrockAgentCoreSDKCodeBuild-us-east-1-ab7e989caa` | — |
| CodeBuild Project | `bedrock-agentcore-agent_with_memory-builder` | — |
| S3 (CodeBuild) | `bedrock-agentcore-codebuild-sources-YOUR_ACCOUNT_ID-us-east-1` | — |

### 7.2 IAM Permissions (Runtime Role)

The execution role `AmazonBedrockAgentCoreSDKRuntime-us-east-1-ab7e989caa` has these inline policies:

| Policy Name | Permissions |
|---|---|
| `BedrockAgentCoreRuntimeExecutionPolicy-Agent_with_memory` | AgentCore runtime permissions |
| `DynamoDBCachePolicy` | GetItem, PutItem on `faq-response-cache` |
| `DynamoNewTablesPolicy` | GetItem, PutItem, UpdateItem on `lauki-user-profiles`, `lauki-faq-gaps` |
| `DynamoRateLimitPolicy` | GetItem, PutItem, UpdateItem on `lauki-rate-limits` |
| `S3FaqIndexPolicy` | GetObject, PutObject, HeadObject, ListBucket on `bedrock-agentcore-faq-index-*` |
| `SecretsManagerPolicy` | GetSecretValue on `lauki-phones/groq-api-key`, `lauki-phones/openai-api-key` |
| `BedrockGuardrailPolicy` | ApplyGuardrail on `guardrail/fns2hq9ym7zf` |
| Bedrock full access | InvokeModel for Titan Embeddings |

### 7.3 DynamoDB Table Schemas

**`faq-response-cache`**
```
PK: question_hash (S) — SHA-256 of query
Attributes: answer (S), ttl (N)
TTL: enabled on 'ttl' attribute
```

**`lauki-user-profiles`**
```
PK: actor_id (S) — UUID from browser
Attributes: plan (S), network_preference (S), updated_at (N)
```

**`lauki-faq-gaps`**
```
PK: question_hash (S) — SHA-256 of unanswered query
Attributes: question (S), count (N), first_seen (N)
```

**`lauki-rate-limits`**
```
PK: actor_id (S)
Attributes: timestamps (L — list of Unix timestamps), ttl (N)
TTL: enabled on 'ttl' attribute (1 hour)
```

### 7.4 AgentCore Deployment Config (`.bedrock_agentcore.yaml`)

Key settings:
```yaml
platform: linux/arm64          # ARM64 container
network_mode: PUBLIC           # Public internet access
idle_runtime_session_timeout: 300  # 5 min idle shutdown
memory:
  mode: STM_AND_LTM
  memory_id: agentcore_first_project-E1UsbWCIfu
```

---

## 8. Security & Compliance

### 8.1 Secrets Management

- **OpenAI API key:** Stored in AWS Secrets Manager (`lauki-phones/openai-api-key`). Fetched at container startup, cached in memory for container lifetime. Never in code, env vars, or logs.
- **AWS credentials (frontend):** Stored as Vercel environment variables (server-side only, never in browser bundle).
- **No secrets in git:** `.gitignore` excludes `.env`, `*.json` policy files, `context*.json`.

### 8.2 Content Safety (Bedrock Guardrails)

Guardrail `fns2hq9ym7zf` v2 filters:

| Filter | Input Strength | Output Strength |
|---|---|---|
| SEXUAL | HIGH | HIGH |
| VIOLENCE | MEDIUM | HIGH |
| HATE | MEDIUM | HIGH |
| INSULTS | LOW | MEDIUM |
| MISCONDUCT | MEDIUM | HIGH |
| PROMPT_ATTACK | HIGH | NONE |
| EMAIL (PII) | ANONYMIZE | — |
| PHONE (PII) | ANONYMIZE | — |
| CREDIT_CARD (PII) | BLOCK | — |

**Fail-open policy:** If Bedrock Guardrails API is unavailable, the request proceeds. This prevents service outages from blocking legitimate users.

### 8.3 Rate Limiting

- 20 requests/hour/user (configurable via `RATE_LIMIT_PER_HOUR` env var)
- Sliding window algorithm (not fixed window)
- Keyed by `actor_id` (browser UUID — not authenticated)
- Fail-open: DynamoDB errors don't block users

### 8.4 Authentication Gap (Known Issue)

Currently `actor_id` defaults to `"default-user"` when not provided. The CLI always sends `default-user`. The frontend generates a UUID per browser but this is not verified. **For public launch, Cognito auth is required** to properly isolate user memories and enforce rate limits per real user.


---

## 9. Memory & State Management

### 9.1 Memory Architecture

```
Per Request:
  actor_id = payload.actor_id (browser UUID or "default-user")
  thread_id = payload.thread_id (session UUID)

STM (Short-Term Memory):
  Backend: AgentCoreMemorySaver
  Scope: Per thread_id (one conversation)
  Storage: AgentCore Memory resource
  Content: Full message history (HumanMessage + AIMessage)
  Trimming: Last 10 messages kept (token limit protection)
  Summarization: AgentCore SUMMARIZATION strategy auto-condenses old turns

LTM (Long-Term Memory):
  Backend: AgentCoreMemoryStore
  Scope: Per actor_id (one user, all sessions)
  Storage: AgentCore Memory resource
  Content: Individual messages stored with UUID keys
  Namespace: (actor_id, thread_id) tuple

User Profile (DynamoDB):
  Table: lauki-user-profiles
  Scope: Per actor_id
  Content: plan, network_preference, updated_at
  Auto-detected from: message content keywords
```

### 9.2 Memory Resource

```
ID: agentcore_first_project-E1UsbWCIfu
Strategy: SUMMARIZATION (built-in)
  - Automatically summarizes old conversation turns
  - Keeps context manageable for long conversations
Event expiry: 99 days
```

### 9.3 Profile Injection Flow

```
User says: "I'm on postpaid 5G plan"
  → pre_model_hook detects "postpaid" and "5g"
  → Saves { plan: "postpaid", network_preference: "5G" } to DynamoDB
  → Next request: profile loaded, injected as:
    SystemMessage("User profile: plan: postpaid, network_preference: 5G")
  → GPT-4o personalizes answer based on plan
```

---

## 10. Cost Optimization

### 10.1 Cost Drivers & Mitigations

| Cost Driver | Mitigation | Savings |
|---|---|---|
| Bedrock Titan Embeddings | S3 FAISS cache — build once, reuse forever | ~100% after first build |
| OpenAI GPT-4o calls | DynamoDB response cache (24h TTL) | ~60-80% for common questions |
| AgentCore container runtime | 5-min idle timeout | Significant for low-traffic periods |
| DynamoDB reads/writes | PAY_PER_REQUEST billing | No cost when idle |
| External API calls | All 4 tools use free APIs | $0 |

### 10.2 Cost Monitoring

```bash
# View costs by project tag
AWS Console → Cost Explorer → Group by Tag → project = lauki-phones
# Note: Tags take 24h to appear in Cost Explorer
```

### 10.3 Cache Hit Rate

Monitor cache effectiveness:
```bash
aws dynamodb scan --table-name faq-response-cache --select COUNT --region us-east-1
```
High item count = high cache utilization = lower LLM costs.

---

## 11. Deployment Guide

### 11.1 Backend Deployment

**Prerequisites:**
- Python 3.13+ with `uv` installed
- `agentcore` CLI: `pip install bedrock-agentcore-starter-toolkit`
- AWS credentials configured
- Frontend dev server stopped (avoids `node_modules` lock issue)

**Deploy command:**
```bash
agentcore launch -a Agent_with_memory
```

**What happens:**
1. CLI zips project source (excluding patterns in dockerignore template)
2. Uploads zip to S3: `bedrock-agentcore-codebuild-sources-YOUR_ACCOUNT_ID-us-east-1`
3. CodeBuild builds ARM64 Docker image (~45 seconds)
4. Image pushed to ECR: `bedrock-agentcore-agent_with_memory`
5. AgentCore updates runtime with new image
6. New container starts on next invocation

**Build time:** ~45s | **Total deploy time:** ~2 minutes

**Important:** Always stop the frontend dev server before deploying. The CLI zips the entire `source_path` (project root) and the `frontend/.next/dev/lock` file causes a Windows permission error.

### 11.2 Frontend Deployment

**Automatic:** Every push to `main` branch triggers Vercel deployment (~30 seconds).

**Manual:**
```bash
cd frontend
vercel deploy --prod
```

**Required Vercel environment variables:**
```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<IAM user key>
AWS_SECRET_ACCESS_KEY=<IAM user secret>
AGENT_ARN=arn:aws:bedrock-agentcore:us-east-1:YOUR_ACCOUNT_ID:runtime/Agent_with_memory-96lnExBamr
```

### 11.3 First-Time Setup Checklist

```bash
# 1. DynamoDB tables
aws dynamodb create-table --table-name faq-response-cache ...
aws dynamodb create-table --table-name lauki-user-profiles ...
aws dynamodb create-table --table-name lauki-faq-gaps ...
aws dynamodb create-table --table-name lauki-rate-limits ...

# 2. S3 bucket
aws s3 mb s3://bedrock-agentcore-faq-index-YOUR_ACCOUNT_ID --region us-east-1

# 3. Secrets
aws secretsmanager create-secret --name lauki-phones/openai-api-key --secret-string "sk-..."

# 4. Guardrail
aws bedrock create-guardrail --name lauki-phones-guardrail ...
aws bedrock create-guardrail-version --guardrail-identifier <id>

# 5. Configure AgentCore
agentcore configure -e 02_agentcore_memory.py

# 6. Deploy
agentcore launch -a Agent_with_memory
```

---

## 12. Development Workflow

### 12.1 Feature Development

```bash
# 1. Create feature branch
git checkout -b feature/your-feature-name

# 2. Make changes

# 3. Test frontend locally
cd frontend && npm run dev
# Open http://localhost:3000

# 4. Test backend (stop frontend first)
agentcore invoke '{"prompt":"hello"}'

# 5. Push and create PR
git add -A
git commit -m "feat: description of change"
git push -u origin feature/your-feature-name
# Create PR on GitHub

# 6. After merge to main:
# Frontend: Vercel auto-deploys (~30s)
# Backend: manually run agentcore launch
```

### 12.2 Updating the FAQ Knowledge Base

```bash
# 1. Edit lauki_qna.csv (add/modify Q&A rows)
# CSV format: question,answer (quoted strings)

# 2. Invalidate S3 FAISS cache
aws s3 rm s3://bedrock-agentcore-faq-index-YOUR_ACCOUNT_ID/faq-index/ --recursive

# 3. Deploy backend
agentcore launch -a Agent_with_memory
# New index builds on first invocation after deploy
```

### 12.3 Changing the LLM

Current: `gpt-4o` via OpenAI API

To switch to a different model, edit `02_agentcore_memory.py`:
```python
# OpenAI GPT-4o (current)
llm = init_chat_model("gpt-4o", model_provider="openai", api_key=OPENAI_API_KEY)

# Claude Sonnet via Bedrock (requires payment method on AWS)
from langchain_aws import ChatBedrock
llm = ChatBedrock(model_id="us.anthropic.claude-sonnet-4-5-20250929-v1:0", region_name=REGION)

# Groq (free tier, lower token limits)
llm = init_chat_model("openai/gpt-oss-20b", model_provider="groq", api_key=GROQ_API_KEY)
```

### 12.4 Adding a New Tool

```python
# In tools.py
@tool
def my_new_tool(param: str) -> str:
    """Description for GPT-4o to understand when to use this tool.
    
    Args:
        param: Description of parameter
    """
    # implementation
    return result

# In 02_agentcore_memory.py — add to tools list
tools = [
    search_faq,
    ...
    my_new_tool,  # add here
]

# Update system_prompt to tell GPT-4o when to use it
```

---

## 13. Monitoring & Observability

### 13.1 CloudWatch Logs

```bash
# Follow live logs
aws logs tail /aws/bedrock-agentcore/runtimes/Agent_with_memory-96lnExBamr-DEFAULT \
  --log-stream-name-prefix "$(date +%Y/%m/%d)/[runtime-logs]" \
  --follow --region us-east-1

# Last 1 hour
aws logs tail /aws/bedrock-agentcore/runtimes/Agent_with_memory-96lnExBamr-DEFAULT \
  --log-stream-name-prefix "$(date +%Y/%m/%d)/[runtime-logs]" \
  --since 1h --region us-east-1
```

**Log format:** JSON with timestamp, level, message, requestId, sessionId, errorType, errorMessage, stackTrace.

**Key log messages to watch:**
- `"Invocation completed successfully"` — normal
- `"Invocation failed"` — check errorType and errorMessage
- `"FAISS index loaded from s3://"` — cold start, index loaded
- `"FAISS index built"` — first build after cache invalidation
- `"Guardrail error (fail open)"` — guardrail API issue, request continued

### 13.2 GenAI Observability Dashboard

```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#gen-ai-observability/agent-core
```

Shows: invocation count, latency (p50/p90/p99), error rate, token usage per call, tool call traces.

Note: Data appears ~10 minutes after first invocation.

### 13.3 agentcore CLI Observability

```bash
agentcore obs --help
agentcore obs spans -a Agent_with_memory
agentcore obs logs -a Agent_with_memory
```

### 13.4 FAQ Gap Monitoring

```bash
# See what questions the agent couldn't answer
aws dynamodb scan --table-name lauki-faq-gaps --region us-east-1
```

Use this weekly to identify gaps in `lauki_qna.csv`.

---

## 14. Troubleshooting Guide

### 14.1 Common Issues

| Symptom | Likely Cause | Fix |
|---|---|---|
| `blocked: true` on valid queries | Stale cache from old guardrail version | Clear DynamoDB cache table |
| 500 error, `tool_use_failed` | LLM generating malformed tool calls | Switch to better tool-calling model |
| 500 error, `ThrottlingException` | Bedrock Titan embeddings rate limit | Wait and retry; or use S3 cache |
| 500 error, `AccessDeniedException` | Missing IAM permission | Check execution role policies |
| 500 error, `INVALID_PAYMENT_INSTRUMENT` | No payment method for Bedrock model | Add credit card to AWS account |
| Deploy fails, `Permission denied: .next/dev/lock` | Frontend dev server running | Stop `npm run dev` before deploying |
| Deploy fails, `node_modules` lock | node_modules present in project | `Remove-Item frontend\node_modules -Recurse -Force` |
| `Rate limit exceeded` | Too many requests | Wait 1 hour or increase `RATE_LIMIT_PER_HOUR` |
| Slow responses | Cold start | First request after 5-min idle is slow (~15-20s) |
| Old response returned | Cache hit from previous version | Clear `faq-response-cache` table |

### 14.2 Debugging Steps

```bash
# 1. Check agent status
agentcore status -a Agent_with_memory

# 2. Check recent logs
aws logs tail /aws/bedrock-agentcore/runtimes/Agent_with_memory-96lnExBamr-DEFAULT \
  --log-stream-name-prefix "$(date +%Y/%m/%d)/[runtime-logs]" \
  --since 10m --region us-east-1

# 3. Test guardrail directly
aws bedrock-runtime apply-guardrail \
  --guardrail-identifier fns2hq9ym7zf \
  --guardrail-version 2 \
  --source INPUT \
  --content '[{"text":{"text":"your query here"}}]' \
  --region us-east-1

# 4. Check cache
aws dynamodb scan --table-name faq-response-cache --select COUNT --region us-east-1

# 5. Force new container (stop current session)
agentcore stop-session --session-id SESSION_ID -a Agent_with_memory

# 6. Test with simple query
agentcore invoke '{"prompt":"hello"}'
```

---

## 15. Environment Variables Reference

### 15.1 Backend (Container Environment)

| Variable | Source | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | Secrets Manager (auto-fetched) | — | OpenAI API key |
| `AWS_REGION` | Container env | `us-east-1` | AWS region |
| `RATE_LIMIT_PER_HOUR` | Optional env var | `20` | Max requests per user per hour |
| `CACHE_TTL_SECONDS` | Optional env var | `86400` | Cache TTL in seconds (24h) |
| `FAQ_INDEX_BUCKET` | Optional env var | `bedrock-agentcore-faq-index-{account}` | S3 bucket for FAISS index |
| `FAQ_CSV_PATH` | Optional env var | `./lauki_qna.csv` | Path to FAQ CSV file |
| `AWS_ACCOUNT_ID` | Optional env var | `YOUR_ACCOUNT_ID` | Used in S3 bucket name |

### 15.2 Frontend (Vercel Environment Variables)

| Variable | Value | Description |
|---|---|---|
| `AWS_REGION` | `us-east-1` | AWS region |
| `AWS_ACCESS_KEY_ID` | IAM user key | Must have `bedrock-agentcore:InvokeAgentRuntime` permission |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret | — |
| `AWS_SESSION_TOKEN` | Optional | Only for temporary credentials |
| `AGENT_ARN` | `arn:aws:bedrock-agentcore:us-east-1:YOUR_ACCOUNT_ID:runtime/Agent_with_memory-96lnExBamr` | Full AgentCore runtime ARN |

---

## 16. Known Limitations & Roadmap

### 16.1 Current Limitations

| Limitation | Impact | Priority Fix |
|---|---|---|
| `actor_id` defaults to `"default-user"` | All CLI users share memory | Add Cognito auth |
| No error handling in `agent_invocation` | Unhandled exceptions return raw 500 | Wrap in try/except |
| AWS credentials in Vercel env vars | Not suitable for public app | Use AgentCore OAuth authorizer |
| Backend deploy is manual | Requires human step after merge | GitHub Actions CI/CD |
| Message trimming is `messages[-10:]` | Hardcoded, not token-aware | Use `trim_messages()` |
| No automated test suite | Regressions not caught | Add `agentcore eval` evals |
| Single region (us-east-1) | Latency for non-US users | Multi-region deployment |

### 16.2 Recommended Next Steps (Priority Order)

1. **Error handling** — Wrap `agent_invocation` in try/except (30 min)
2. **Cognito auth** — User Pool + next-auth + JWT actor_id (2-3 hours)
3. **GitHub Actions** — Auto-deploy backend on merge to main (1 hour)
4. **Evals** — 10 test cases with `agentcore eval` (1 hour)
5. **Token-aware trimming** — Replace `[-10:]` with `trim_messages()` (30 min)
6. **AgentCore OAuth** — Replace Vercel env vars with proper auth (2 hours)

---

## 17. Quick Reference Commands

```bash
# ── DEPLOYMENT ──────────────────────────────────────────────────
agentcore launch -a Agent_with_memory          # Deploy backend
agentcore status -a Agent_with_memory          # Check status
agentcore stop-session --session-id ID -a Agent_with_memory  # Force new container

# ── TESTING ─────────────────────────────────────────────────────
agentcore invoke '{"prompt":"hello"}'          # Basic test
agentcore invoke '{"prompt":"how to activate roaming?"}'  # FAQ test

# ── LOGS ────────────────────────────────────────────────────────
aws logs tail /aws/bedrock-agentcore/runtimes/Agent_with_memory-96lnExBamr-DEFAULT \
  --log-stream-name-prefix "$(date +%Y/%m/%d)/[runtime-logs]" \
  --follow --region us-east-1

# ── CACHE ───────────────────────────────────────────────────────
aws dynamodb scan --table-name faq-response-cache --select COUNT --region us-east-1
aws dynamodb delete-table --table-name faq-response-cache --region us-east-1
# Recreate after deletion (see First-Time Setup)

# ── FAISS INDEX ─────────────────────────────────────────────────
aws s3 ls s3://bedrock-agentcore-faq-index-YOUR_ACCOUNT_ID/faq-index/
aws s3 rm s3://bedrock-agentcore-faq-index-YOUR_ACCOUNT_ID/faq-index/ --recursive

# ── FAQ GAPS ────────────────────────────────────────────────────
aws dynamodb scan --table-name lauki-faq-gaps --region us-east-1

# ── GUARDRAIL ───────────────────────────────────────────────────
aws bedrock-runtime apply-guardrail \
  --guardrail-identifier fns2hq9ym7zf --guardrail-version 2 \
  --source INPUT --content '[{"text":{"text":"test query"}}]' \
  --region us-east-1

# ── RESOURCES ───────────────────────────────────────────────────
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=project,Values=lauki-phones --region us-east-1

# ── FRONTEND ────────────────────────────────────────────────────
cd frontend && npm run dev                     # Local development
cd frontend && npm run build                   # Verify build
```
