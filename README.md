<div align="center">

# 🤖 Lauki Phones AI Agent

### Production-grade telecom customer support AI agent built on Amazon Bedrock AgentCore

[![Platform](https://img.shields.io/badge/Platform-Amazon%20Bedrock%20AgentCore-FF9900?style=for-the-badge&logo=amazonaws)](https://aws.amazon.com/bedrock/agentcore/)
[![LLM](https://img.shields.io/badge/LLM-GPT--4o-412991?style=for-the-badge&logo=openai)](https://openai.com)
[![Framework](https://img.shields.io/badge/Framework-LangGraph-1C3C3C?style=for-the-badge)](https://langchain-ai.github.io/langgraph/)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js%2016-000000?style=for-the-badge&logo=nextdotjs)](https://nextjs.org)
[![Deploy](https://img.shields.io/badge/Deploy-Vercel-000000?style=for-the-badge&logo=vercel)](https://lauki-phones-ai-agent.vercel.app/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

[Demo](https://lauki-phones-ai-agent.vercel.app/) · [Features](#features) · [Architecture](#architecture) · [Quick Start](#quick-start) · [Documentation](#documentation)

</div>

---

## Overview

**Lauki Phones AI Agent** is a production-ready telecom customer support system that demonstrates how to build, deploy, and operate an AI agent at scale using Amazon Bedrock AgentCore. It handles customer queries about plans, billing, network issues, SIM management, international roaming, and device compatibility — with persistent memory, real-time data enrichment, and enterprise-grade safety controls.

This project serves as a reference implementation for:
- Building RAG-powered agents with persistent memory on AWS
- Deploying LangGraph agents to serverless ARM64 containers
- Integrating cost optimization patterns (caching, S3 index persistence)
- Implementing production safety controls (guardrails, rate limiting, sentiment detection)

---

## Features

### 🧠 AI & RAG
| Feature | Details |
|---|---|
| **RAG Pipeline** | FAISS vector search over telecom FAQ knowledge base using Amazon Bedrock Titan Embeddings v2 |
| **S3 Index Cache** | FAISS index built once, cached to S3 — zero embedding API calls on subsequent cold starts |
| **GPT-4o** | OpenAI's best tool-calling model for accurate, structured responses |
| **LangGraph ReAct** | Reasoning + Acting loop — agent decides which tools to call based on context |

### 💾 Memory
| Feature | Details |
|---|---|
| **Short-term Memory** | Full conversation history per session via `AgentCoreMemorySaver` |
| **Long-term Memory** | Cross-session user preferences via `AgentCoreMemoryStore` |
| **User Profiles** | Auto-detects user's plan and network preference, personalizes future responses |
| **Memory Summarization** | AgentCore built-in SUMMARIZATION strategy keeps context manageable |

### 🛡️ Safety & Reliability
| Feature | Details |
|---|---|
| **Bedrock Guardrails** | Blocks hate speech, violence, sexual content, PII, and prompt injection |
| **Rate Limiting** | 20 requests/hour/user via DynamoDB sliding window |
| **Sentiment Detection** | Frustrated users get empathetic responses + escalation offer |
| **Response Cache** | DynamoDB 24h TTL — repeated questions answered instantly |
| **FAQ Gap Detection** | Unanswered questions logged to DynamoDB for knowledge base improvement |

### 🌐 Real-time Tools (All Free, No API Keys)
| Tool | API | Use Case |
|---|---|---|
| Weather & Network Impact | open-meteo.com | Correlates weather with signal issues |
| Country Information | restcountries.com | Enriches roaming and international call queries |
| Phone Number Validation | abstractapi.com | Validates numbers before porting requests |
| Public Holidays | date.nager.at | Adjusts SLA expectations on holidays |

### 💰 Cost Optimization
- **S3 FAISS cache** — Bedrock Titan embeddings called once, reused forever
- **DynamoDB response cache** — Common questions answered without LLM call
- **Groq LLM option** — Cheapest fast inference as alternative to GPT-4o
- **Idle timeout** — Container stops after 5 min idle
- **PAY_PER_REQUEST** — All DynamoDB tables on-demand billing

---

## Architecture

```
Browser (Next.js on Vercel)
        │ HTTPS POST /api/chat (SigV4 signed, server-side)
        ▼
Amazon Bedrock AgentCore Runtime
(ARM64 container, idle timeout 5 min)
        │
        ├── Rate Limiter ──────────────→ DynamoDB
        ├── Bedrock Guardrails ────────→ AWS Bedrock
        ├── Sentiment Detection ───────→ Keyword matching
        ├── Response Cache ────────────→ DynamoDB (24h TTL)
        │
        ▼
LangGraph ReAct Agent (GPT-4o)
        ├── search_faq ────────────────→ FAISS + S3 cache
        ├── search_detailed_faq ───────→ FAISS
        ├── reformulate_query ─────────→ FAISS
        ├── get_weather_network_impact →  open-meteo.com
        ├── get_country_info ──────────→ restcountries.com
        ├── validate_phone_number ─────→ abstractapi.com
        └── check_public_holidays ─────→ date.nager.at
        │
        ▼
AgentCore Memory
        ├── STM: conversation per session
        └── LTM: user profile across sessions
```

---

## Project Structure

```
├── 02_agentcore_memory.py    # Main agent — all backend logic
├── faq_store.py              # FAISS vector store with S3 caching
├── cache.py                  # DynamoDB response cache
├── tools.py                  # 4 free external API tools
├── lauki_qna.csv             # Telecom FAQ knowledge base (75 Q&A pairs)
├── pyproject.toml            # Python dependencies (uv)
├── .bedrock_agentcore.yaml   # AgentCore deployment config
├── KT_DOCUMENT.md            # Detailed knowledge transfer document
└── frontend/                 # Next.js chat UI
    ├── app/
    │   ├── page.tsx              # Root page
    │   ├── layout.tsx
    │   └── api/chat/route.ts     # SigV4 proxy to AgentCore
    ├── components/
    │   ├── Sidebar.tsx           # Session management
    │   ├── ChatPanel.tsx         # Chat interface
    │   ├── MessageBubble.tsx     # Markdown rendering + copy button
    │   └── TypingIndicator.tsx
    ├── store/chat.ts             # Zustand state (sessions, user)
    └── types/chat.ts
```

---

## Quick Start

### Prerequisites

- Python 3.13+ with [`uv`](https://docs.astral.sh/uv/)
- AWS account with Bedrock AgentCore access (us-east-1)
- OpenAI API key
- `agentcore` CLI: `pip install bedrock-agentcore-starter-toolkit`
- Node.js 18+ (for frontend)

### 1. Clone & Install

```bash
git clone https://github.com/ABSatpute/Lauki-Phones-AI-Agent.git
cd Lauki-Phones-AI-Agent
uv sync
```

### 2. AWS Setup

```bash
# Set your AWS account ID
export AWS_ACCOUNT_ID=your_12_digit_account_id

# Store OpenAI API key
aws secretsmanager create-secret \
  --name lauki-phones/openai-api-key \
  --secret-string "sk-your-openai-key" \
  --region us-east-1

# Create S3 bucket for FAISS index
aws s3 mb s3://bedrock-agentcore-faq-index-${AWS_ACCOUNT_ID} --region us-east-1

# Create DynamoDB tables
aws dynamodb create-table --table-name faq-response-cache \
  --attribute-definitions AttributeName=question_hash,AttributeType=S \
  --key-schema AttributeName=question_hash,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region us-east-1

aws dynamodb update-time-to-live --table-name faq-response-cache \
  --time-to-live-specification Enabled=true,AttributeName=ttl --region us-east-1

aws dynamodb create-table --table-name lauki-user-profiles \
  --attribute-definitions AttributeName=actor_id,AttributeType=S \
  --key-schema AttributeName=actor_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region us-east-1

aws dynamodb create-table --table-name lauki-faq-gaps \
  --attribute-definitions AttributeName=question_hash,AttributeType=S \
  --key-schema AttributeName=question_hash,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region us-east-1

aws dynamodb create-table --table-name lauki-rate-limits \
  --attribute-definitions AttributeName=actor_id,AttributeType=S \
  --key-schema AttributeName=actor_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region us-east-1

aws dynamodb update-time-to-live --table-name lauki-rate-limits \
  --time-to-live-specification Enabled=true,AttributeName=ttl --region us-east-1
```

### 3. Create Bedrock Guardrail

```bash
aws bedrock create-guardrail \
  --name "lauki-phones-guardrail" \
  --content-policy-config file://guardrail-content.json \
  --sensitive-information-policy-config file://guardrail-pii.json \
  --blocked-input-messaging "I can only help with Lauki Phones telecom queries." \
  --blocked-outputs-messaging "I cannot provide that information." \
  --region us-east-1
```

Update `GUARDRAIL_ID` and `GUARDRAIL_VERSION` in `02_agentcore_memory.py` with the returned values.

### 4. Configure & Deploy

```bash
# Configure AgentCore (first time only)
agentcore configure -e 02_agentcore_memory.py

# Deploy
agentcore launch -a Agent_with_memory --env AWS_ACCOUNT_ID=your_account_id
```

### 5. Test

```bash
agentcore invoke '{"prompt":"how to activate roaming?"}'
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
AGENT_ARN=arn:aws:bedrock-agentcore:us-east-1:YOUR_ACCOUNT_ID:runtime/Agent_with_memory-XXXXX
```

```bash
npm run dev
# Open http://localhost:3000
```

### Deploy to Vercel

1. Push to GitHub
2. Connect repo to [Vercel](https://vercel.com)
3. Set Root Directory to `frontend`
4. Add environment variables
5. Deploy — auto-deploys on every push to `main`

---

## API Reference

### Invoke Payload

```json
{
  "prompt": "How do I activate roaming for Dubai?",
  "actor_id": "user-123",
  "thread_id": "session-abc"
}
```

### Response

```json
{
  "result": "To activate roaming...",
  "actor_id": "user-123",
  "thread_id": "session-abc",
  "tools_used": ["search_faq", "get_country_info"],
  "cached": false,
  "escalation_flagged": false,
  "blocked": false
}
```

### Response Fields

| Field | Type | Description |
|---|---|---|
| `result` | string | Agent's answer (markdown formatted) |
| `actor_id` | string | User identifier |
| `thread_id` | string | Session identifier |
| `tools_used` | string[] | List of tools called during this request |
| `cached` | boolean | `true` if response came from DynamoDB cache |
| `escalation_flagged` | boolean | `true` if frustration detected |
| `blocked` | boolean | `true` if guardrail blocked the request |

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AWS_ACCOUNT_ID` | ✅ | — | Your 12-digit AWS account ID |
| `OPENAI_API_KEY` | ✅ | Secrets Manager | OpenAI API key (auto-fetched) |
| `AWS_REGION` | — | `us-east-1` | AWS region |
| `RATE_LIMIT_PER_HOUR` | — | `20` | Max requests per user per hour |
| `CACHE_TTL_SECONDS` | — | `86400` | Response cache TTL (24h) |
| `FAQ_CSV_PATH` | — | `./lauki_qna.csv` | Path to FAQ knowledge base |

### Updating the Knowledge Base

1. Edit `lauki_qna.csv` (CSV format: `question,answer`)
2. Invalidate S3 cache:
   ```bash
   aws s3 rm s3://bedrock-agentcore-faq-index-${AWS_ACCOUNT_ID}/faq-index/ --recursive
   ```
3. Redeploy — new index builds on first invocation

---

## AWS Resources Created

| Resource | Name | Purpose |
|---|---|---|
| AgentCore Runtime | `Agent_with_memory` | Hosts the agent container |
| AgentCore Memory | `agentcore_first_project` | STM + LTM storage |
| ECR Repository | `bedrock-agentcore-agent_with_memory` | Docker images |
| S3 Bucket | `bedrock-agentcore-faq-index-{account}` | FAISS index cache |
| DynamoDB | `faq-response-cache` | Response cache (24h TTL) |
| DynamoDB | `lauki-user-profiles` | User plan/preferences |
| DynamoDB | `lauki-faq-gaps` | Unanswered question logging |
| DynamoDB | `lauki-rate-limits` | Rate limiting (1h TTL) |
| Secrets Manager | `lauki-phones/openai-api-key` | OpenAI API key |
| Bedrock Guardrail | `lauki-phones-guardrail` | Content safety |
| IAM Roles | `AmazonBedrockAgentCoreSDKRuntime-*` | Execution permissions |
| CodeBuild | `bedrock-agentcore-agent_with_memory-builder` | ARM64 builds |

---

## Monitoring

```bash
# Live logs
aws logs tail /aws/bedrock-agentcore/runtimes/RUNTIME_ID-DEFAULT \
  --log-stream-name-prefix "$(date +%Y/%m/%d)/[runtime-logs]" \
  --follow --region us-east-1

# GenAI Observability Dashboard
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#gen-ai-observability/agent-core

# FAQ gaps (unanswered questions)
aws dynamodb scan --table-name lauki-faq-gaps --region us-east-1
```

---

## Development

```bash
# Feature branch workflow
git checkout -b feature/your-feature
# make changes
git add -A && git commit -m "feat: description"
git push -u origin feature/your-feature
# Create PR → merge → Vercel auto-deploys frontend
# Backend: agentcore launch after merge
```

See [KT_DOCUMENT.md](KT_DOCUMENT.md) for detailed technical documentation.

---
## Roadmap

- [ ] Cognito authentication for proper user isolation
- [ ] GitHub Actions CI/CD for automated backend deployment
- [ ] Token-aware conversation trimming
- [ ] Automated evaluation suite with `agentcore eval`
- [ ] Multi-language support (Hindi, Arabic)
- [ ] AgentCore OAuth authorizer for public deployment

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">
Built with ❤️ using <a href="https://aws.amazon.com/bedrock/agentcore/">Amazon Bedrock AgentCore</a>, <a href="https://langchain-ai.github.io/langgraph/">LangGraph</a>, and <a href="https://nextjs.org">Next.js</a>
</div>
