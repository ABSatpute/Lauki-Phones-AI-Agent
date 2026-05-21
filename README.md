# Lauki Phones AI Agent

A production-grade telecom customer support AI agent built on **Amazon Bedrock AgentCore**, featuring RAG, persistent memory, real-time tool integrations, and a Next.js chat frontend.

![Architecture](https://img.shields.io/badge/Platform-Amazon%20Bedrock%20AgentCore-orange) ![LLM](https://img.shields.io/badge/LLM-Groq%20gpt--oss--20b-blue) ![Frontend](https://img.shields.io/badge/Frontend-Next.js%2016-black)

---

## Architecture

```
User (Next.js Chat UI)
        ↓
API Route (SigV4 signed)
        ↓
Amazon Bedrock AgentCore Runtime (ARM64 container)
        ↓
LangGraph ReAct Agent (Groq gpt-oss-20b)
        ├── FAQ Tools (FAISS + Bedrock Titan Embeddings)
        ├── Weather Tool (open-meteo.com)
        ├── Country Info Tool (restcountries.com)
        ├── Phone Validation Tool
        └── Public Holidays Tool (date.nager.at)
        ↓
AgentCore Memory (STM + LTM)
        ↓
DynamoDB (response cache + user profiles + FAQ gaps + rate limits)
        ↓
S3 (FAISS index cache)
```

---

## Features

| Feature | Description |
|---|---|
| **RAG** | FAISS vector search over telecom FAQ CSV using Bedrock Titan embeddings |
| **S3 Index Cache** | FAISS index built once, cached to S3 — zero embedding calls on cold start |
| **Response Cache** | DynamoDB cache (24h TTL) — repeated questions answered instantly |
| **Short-term Memory** | Full conversation history per session via `AgentCoreMemorySaver` |
| **Long-term Memory** | Cross-session user preferences via `AgentCoreMemoryStore` |
| **User Profiles** | Agent detects and stores user's plan/preferences automatically |
| **Sentiment Detection** | Frustrated users get empathetic responses + escalation offer |
| **FAQ Gap Detection** | Unanswered questions logged to DynamoDB for knowledge base improvement |
| **Rate Limiting** | 20 requests/hour/user via DynamoDB sliding window |
| **4 Free API Tools** | Weather, country info, phone validation, public holidays |
| **Secrets Manager** | GROQ_API_KEY stored in AWS Secrets Manager, not env vars |
| **Idle Timeout** | Container shuts down after 5 min idle to save cost |

---

## Project Structure

```
├── 02_agentcore_memory.py    # Main agent entrypoint
├── faq_store.py              # FAISS + S3 caching layer
├── cache.py                  # DynamoDB response cache
├── tools.py                  # 4 free API tools
├── lauki_qna.csv             # Telecom FAQ knowledge base
├── pyproject.toml            # Python dependencies
├── .bedrock_agentcore.yaml   # AgentCore deployment config
└── frontend/                 # Next.js chat UI
    ├── app/
    │   ├── page.tsx          # Root page
    │   ├── layout.tsx
    │   └── api/chat/route.ts # SigV4 proxy to AgentCore
    ├── components/
    │   ├── Sidebar.tsx       # Session management sidebar
    │   ├── ChatPanel.tsx     # Main chat interface
    │   ├── MessageBubble.tsx # Markdown-rendered messages
    │   └── TypingIndicator.tsx
    ├── store/chat.ts         # Zustand state (sessions, user)
    └── types/chat.ts
```

---

## Prerequisites

- Python 3.13+
- AWS account with Bedrock AgentCore access (us-east-1)
- [Groq API key](https://console.groq.com)
- `uv` package manager
- `agentcore` CLI (`pip install bedrock-agentcore-starter-toolkit`)
- Node.js 18+ (for frontend)

---

## Backend Setup

### 1. Install dependencies

```bash
uv sync
```

### 2. Store Groq API key in Secrets Manager

```bash
aws secretsmanager create-secret \
  --name lauki-phones/groq-api-key \
  --secret-string "your_groq_api_key" \
  --region us-east-1
```

### 3. Create DynamoDB tables

```bash
# Response cache
aws dynamodb create-table --table-name faq-response-cache \
  --attribute-definitions AttributeName=question_hash,AttributeType=S \
  --key-schema AttributeName=question_hash,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region us-east-1

aws dynamodb update-time-to-live --table-name faq-response-cache \
  --time-to-live-specification Enabled=true,AttributeName=ttl --region us-east-1

# User profiles
aws dynamodb create-table --table-name lauki-user-profiles \
  --attribute-definitions AttributeName=actor_id,AttributeType=S \
  --key-schema AttributeName=actor_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region us-east-1

# FAQ gaps
aws dynamodb create-table --table-name lauki-faq-gaps \
  --attribute-definitions AttributeName=question_hash,AttributeType=S \
  --key-schema AttributeName=question_hash,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region us-east-1

# Rate limits
aws dynamodb create-table --table-name lauki-rate-limits \
  --attribute-definitions AttributeName=actor_id,AttributeType=S \
  --key-schema AttributeName=actor_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region us-east-1

aws dynamodb update-time-to-live --table-name lauki-rate-limits \
  --time-to-live-specification Enabled=true,AttributeName=ttl --region us-east-1
```

### 4. Create S3 bucket for FAISS index

```bash
aws s3 mb s3://bedrock-agentcore-faq-index-YOUR_ACCOUNT_ID --region us-east-1
```

### 5. Configure and deploy

```bash
# Configure (first time only)
agentcore configure -e 02_agentcore_memory.py

# Deploy
agentcore launch -a Agent_with_memory
```

### 6. Test

```bash
agentcore invoke "{'prompt':'how to activate roaming?'}"
```

---

## Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AGENT_ARN=arn:aws:bedrock-agentcore:us-east-1:YOUR_ACCOUNT:runtime/Agent_with_memory-XXXXX
```

```bash
npm run dev
# Open http://localhost:3000
```

---

## Invoke Payload

```json
{
  "prompt": "How do I activate roaming for Dubai?",
  "actor_id": "user-123",
  "thread_id": "session-abc"
}
```

**Response:**

```json
{
  "result": "...",
  "actor_id": "user-123",
  "thread_id": "session-abc",
  "tools_used": ["get_country_info", "search_faq"],
  "cached": false,
  "escalation_flagged": false
}
```

---

## AWS Resources Created

| Resource | Name |
|---|---|
| AgentCore Runtime | `Agent_with_memory` |
| ECR Repository | `bedrock-agentcore-agent_with_memory` |
| AgentCore Memory | `agentcore_first_project` |
| S3 Bucket | `bedrock-agentcore-faq-index-{account}` |
| DynamoDB Tables | `faq-response-cache`, `lauki-user-profiles`, `lauki-faq-gaps`, `lauki-rate-limits` |
| Secrets Manager | `lauki-phones/groq-api-key` |
| IAM Roles | `AmazonBedrockAgentCoreSDKRuntime-*`, `AmazonBedrockAgentCoreSDKCodeBuild-*` |

---

## Cost Optimizations

- **S3 FAISS cache** — Bedrock Titan embeddings called once, index reused across all cold starts
- **DynamoDB response cache** — Common questions answered without LLM call (24h TTL)
- **Groq LLM** — Cheapest fast inference available
- **Idle timeout** — Container stops after 5 min idle
- **PAY_PER_REQUEST** — All DynamoDB tables on-demand billing

---

## License

MIT
