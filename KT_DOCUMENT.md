# Knowledge Transfer Document
# Lauki Phones AI Agent

**Repository:** https://github.com/ABSatpute/Lauki-Phones-AI-Agent  
**AWS Account:** 417780655467 (us-east-1)  
**Date:** May 2026

---

## 1. What This Project Is

A production telecom customer support AI agent for "Lauki Phones" (fictional Indian carrier). Customers chat with the agent to get answers about plans, billing, network, SIM, roaming, and devices. The agent uses a knowledge base (CSV), real-time external APIs, persistent memory, and content safety guardrails.

**Live:**
- Frontend: Vercel (auto-deploys on push to `main`)
- Backend: Amazon Bedrock AgentCore (`Agent_with_memory-96lnExBamr`, us-east-1)

---

## 2. Architecture

```
Browser
  │ HTTPS POST /api/chat
  ▼
Next.js API Route (Vercel, server-side)
  │ SigV4 signed HTTPS
  ▼
Amazon Bedrock AgentCore Runtime
(ARM64 container, idle timeout 5 min)
  │
  ▼
agent_invocation()
  ├── 1. Rate limit (DynamoDB, 20 req/hr/user)
  ├── 2. Guardrail (Bedrock, blocks hate/violence/PII)
  ├── 3. Sentiment detection (keyword-based escalation)
  ├── 4. Cache check (DynamoDB, 24h TTL)
  │
  ▼
LangGraph ReAct Agent (GPT-4o)
  ├── search_faq → FAISS + Bedrock Titan Embeddings (S3-cached)
  ├── search_detailed_faq → same FAISS, more results
  ├── reformulate_query → aspect-focused search
  ├── get_weather_network_impact → open-meteo.com
  ├── get_country_info → restcountries.com
  ├── validate_phone_number → abstractapi.com
  └── check_public_holidays → date.nager.at
  │
  ▼
AgentCore Memory
  ├── STM: full conversation per session (AgentCoreMemorySaver)
  └── LTM: user profile across sessions (AgentCoreMemoryStore)
```

---

## 3. File Structure

```
├── 02_agentcore_memory.py   # Main agent — all backend logic
├── faq_store.py             # FAISS vector store with S3 caching
├── cache.py                 # DynamoDB response cache
├── tools.py                 # 4 free external API tools
├── lauki_qna.csv            # FAQ knowledge base (75 Q&A pairs)
├── pyproject.toml           # Python dependencies
├── .bedrock_agentcore.yaml  # AgentCore deployment config
└── frontend/
    ├── app/api/chat/route.ts    # SigV4 proxy to AgentCore
    ├── components/
    │   ├── Sidebar.tsx          # Session list, user profile
    │   ├── ChatPanel.tsx        # Chat UI, input
    │   ├── MessageBubble.tsx    # Markdown rendering, copy button
    │   └── TypingIndicator.tsx
    ├── store/chat.ts            # Zustand state (sessions, user)
    └── types/chat.ts
```

---

## 4. Backend — Key Files

### `02_agentcore_memory.py`

Main entrypoint. Request flow:
1. Extract `query`, `actor_id`, `thread_id` from payload
2. Rate limit check → DynamoDB sliding window
3. Guardrail check → Bedrock `fns2hq9ym7zf` v2
4. Sentiment detection → keyword match → escalation flag
5. Cache check → DynamoDB SHA-256 hash lookup
6. Agent invoke → LangGraph + GPT-4o
7. Cache write → 24h TTL
8. Return `result`, `tools_used`, `cached`, `escalation_flagged`, `blocked`

**Key constants:**
```python
MEMORY_ID = "agentcore_first_project-E1UsbWCIfu"
GUARDRAIL_ID = "fns2hq9ym7zf"
GUARDRAIL_VERSION = "2"
RATE_LIMIT = 20  # per hour, override via RATE_LIMIT_PER_HOUR env var
```

**OpenAI key** fetched from Secrets Manager at startup: `lauki-phones/openai-api-key`

### `faq_store.py`

Loads `lauki_qna.csv` → FAISS index using Bedrock Titan Embeddings.  
S3 cache: `s3://bedrock-agentcore-faq-index-417780655467/faq-index/`  
- First run: builds index, uploads to S3
- Subsequent runs: downloads from S3 (zero embedding API calls)
- To force rebuild: delete the S3 prefix

### `cache.py`

DynamoDB table `faq-response-cache`. Key = SHA-256(query). TTL = 24h.  
Fails silently — cache errors never block the agent.

### `tools.py`

| Tool | API | When used |
|---|---|---|
| `get_weather_network_impact` | open-meteo.com | Signal issues + city mentioned |
| `get_country_info` | restcountries.com | Country mentioned |
| `validate_phone_number` | abstractapi.com | Phone number for porting |
| `check_public_holidays` | date.nager.at | Support SLA/timeline questions |

All free, no API keys.

---

## 5. Frontend — Key Files

### `app/api/chat/route.ts`

Server-side Next.js route. Signs requests with AWS SigV4 (`aws4` library) and proxies to AgentCore. AWS credentials stay server-side, never exposed to browser.

**Endpoint:** `https://bedrock-agentcore.us-east-1.amazonaws.com/runtimes/{ARN}/invocations`

### `store/chat.ts`

Zustand store persisted to `localStorage`.
- `user.actorId` — UUID generated once per browser, used as LTM key
- `sessions` — array of conversations with messages
- Session auto-titles from first user message

---

## 6. AWS Resources

| Resource | ID/Name | Purpose |
|---|---|---|
| AgentCore Runtime | `Agent_with_memory-96lnExBamr` | Hosts agent container |
| AgentCore Memory | `agentcore_first_project-E1UsbWCIfu` | STM + LTM (SUMMARIZATION strategy) |
| ECR | `bedrock-agentcore-agent_with_memory` | Docker images |
| S3 | `bedrock-agentcore-faq-index-417780655467` | FAISS index cache |
| DynamoDB | `faq-response-cache` | Response cache (24h TTL) |
| DynamoDB | `lauki-user-profiles` | User plan/preferences |
| DynamoDB | `lauki-faq-gaps` | Unanswered question logging |
| DynamoDB | `lauki-rate-limits` | Rate limiting (1h TTL) |
| Secrets Manager | `lauki-phones/openai-api-key` | OpenAI key |
| Secrets Manager | `lauki-phones/groq-api-key` | Groq key (legacy) |
| Bedrock Guardrail | `fns2hq9ym7zf` v2 | Content/PII filtering |
| IAM Role (Runtime) | `AmazonBedrockAgentCoreSDKRuntime-us-east-1-ab7e989caa` | Agent permissions |
| IAM Role (Build) | `AmazonBedrockAgentCoreSDKCodeBuild-us-east-1-ab7e989caa` | Build permissions |
| CodeBuild | `bedrock-agentcore-agent_with_memory-builder` | ARM64 builds |

**All tagged:** `project=lauki-phones`, `env=production`

---

## 7. Deployment

### Backend
```bash
# Stop frontend dev server first (avoids node_modules lock)
agentcore launch -a Agent_with_memory
# Build: ~45s | Total: ~2 min
```

### Frontend
Automatic on push to `main` via Vercel. Manual: `vercel deploy --prod` from `frontend/`.

---

## 8. Development Workflow

```bash
# Feature branch
git checkout -b feature/name

# Test frontend locally
cd frontend && npm run dev

# Test backend
agentcore invoke '{"prompt":"hello"}'

# Push + PR
git add -A && git commit -m "description"
git push -u origin feature/name
# Merge PR → Vercel auto-deploys frontend
# Backend: run agentcore launch manually after merge
```

### Update FAQ
1. Edit `lauki_qna.csv`
2. Delete S3 cache: `aws s3 rm s3://bedrock-agentcore-faq-index-417780655467/faq-index/ --recursive`
3. Deploy backend

---

## 9. Environment Variables

### Backend
| Variable | Source | Default |
|---|---|---|
| `OPENAI_API_KEY` | Secrets Manager (auto) | — |
| `AWS_REGION` | Container | us-east-1 |
| `RATE_LIMIT_PER_HOUR` | Optional env | 20 |
| `CACHE_TTL_SECONDS` | Optional env | 86400 |

### Frontend (Vercel)
| Variable | Value |
|---|---|
| `AWS_REGION` | us-east-1 |
| `AWS_ACCESS_KEY_ID` | IAM user key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret |
| `AGENT_ARN` | `arn:aws:bedrock-agentcore:us-east-1:417780655467:runtime/Agent_with_memory-96lnExBamr` |

---

## 10. Monitoring

```bash
# Live logs
aws logs tail /aws/bedrock-agentcore/runtimes/Agent_with_memory-96lnExBamr-DEFAULT \
  --log-stream-name-prefix "$(date +%Y/%m/%d)/[runtime-logs]" --follow --region us-east-1

# GenAI Dashboard
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#gen-ai-observability/agent-core

# Cost by project
AWS Cost Explorer → Group by Tag → project = lauki-phones

# FAQ gaps (unanswered questions)
aws dynamodb scan --table-name lauki-faq-gaps --region us-east-1
```

---

## 11. Quick Reference

```bash
agentcore status -a Agent_with_memory          # Check deployment status
agentcore invoke '{"prompt":"hello"}'          # Test agent
agentcore stop-session --session-id ID -a Agent_with_memory  # Force new container

# Clear response cache
aws dynamodb delete-table --table-name faq-response-cache --region us-east-1
# Recreate after deletion

# Invalidate FAISS index
aws s3 rm s3://bedrock-agentcore-faq-index-417780655467/faq-index/ --recursive
```

---

## 12. Known Gaps (Before Public Launch)

| Gap | Fix |
|---|---|
| `actor_id` defaults to `"default-user"` — all users share memory | Add Cognito auth, use JWT `sub` as `actor_id` |
| No error handling in `agent_invocation` | Wrap in try/except, return user-friendly message |
| AWS credentials in Vercel env vars | Use AgentCore OAuth authorizer + Cognito |
| Backend deploy is manual | Add GitHub Action to auto-deploy on merge to `main` |
| Message trimming is hardcoded `[-10:]` | Use token-aware `trim_messages()` |
| No automated test suite | Add `agentcore eval` evals |
