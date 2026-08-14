# 🔬 Scientific Paper Reviewer (SPR)

[![CI](https://github.com/PrajwalK01/PaperLens/actions/workflows/ci.yml/badge.svg)](https://github.com/PrajwalK01/PaperLens/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/PrajwalK01/PaperLens/branch/main/graph/badge.svg?token=b811d301-eb95-4936-bd4b-607c4b4706fc)](https://codecov.io/gh/PrajwalK01/PaperLens)
[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**AI-powered peer review for academic papers** — 5 independent LLM agents debate your paper and deliver a structured verdict in minutes.

🌐 **Live Demo:** [paper-lens-liart.vercel.app](https://paper-lens-liart.vercel.app)  
⚙️ **API Docs:** [paperlens-kr0g.onrender.com/docs](https://paperlens-kr0g.onrender.com/docs)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **5-Agent Pipeline** | Two independent groups (primary + critic each) + synthesizer |
| 🔍 **RAG Retrieval** | Papers chunked by section, embedded in ChromaDB for precise answers |
| 🛡️ **Integrity Checks** | Plagiarism similarity + AI-text heuristic + LLM-as-judge |
| 💬 **Research Chat** | Ask questions about your paper — powered by RAG |
| 📚 **Related Papers** | Auto-discovers related work via OpenAlex (200M+ papers) |
| 📊 **Observability** | Every agent action logged with timing, model and token cost |
| 🔐 **Auth + OTP** | Email verification via Gmail SMTP |
| 🚀 **Deployed** | Frontend on Vercel, backend on Render |

---

## 🏗️ Architecture

```
Frontend (React + Vite + Tailwind)  →  Backend (FastAPI + LangGraph)
                                              │
                          ┌───────────────────┼───────────────────┐
                          │                   │                   │
                    ChromaDB              SQLite/PG           Groq API
                    (RAG vectors)         (Database)         (LLM calls)
                          │
                    OpenAlex API
                    (Related papers)
```

### Review Pipeline
```
Upload PDF/arXiv ID
      │
      ├── Integrity Check (parallel)
      │     ├── Plagiarism similarity
      │     └── AI-text heuristic
      │
      ├── Group A Primary (Groq llama-3.3-70b)  ┐
      ├── Group B Primary (Groq llama-3.3-70b)  ┘ parallel
      │
      ├── Group A Critic  ┐
      ├── Group B Critic  ┘ parallel
      │
      └── Synthesizer → Final Verdict (score/10 + recommendation)
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- [Groq API key](https://console.groq.com) (free)

### Run Locally

```bash
# Clone
git clone https://github.com/PrajwalK01/PaperLens.git
cd PaperLens

# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate      # Windows
pip install -r requirements.txt
cp .env.docker.example .env  # Edit with your GROQ_API_KEY

# Frontend
cd ../frontend
npm install

# Start both (Windows)
cd ..
start-local.bat
```

Open **http://localhost:5173**

---

## 🔑 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅ | Groq API key (free at console.groq.com) |
| `SECRET_KEY` | ✅ | JWT signing key (any random string) |
| `SMTP_HOST` | Optional | Gmail SMTP for OTP emails |
| `SMTP_USERNAME` | Optional | Gmail address |
| `SMTP_PASSWORD` | Optional | Gmail App Password |
| `DATABASE_URL` | Optional | PostgreSQL URL (defaults to SQLite) |

---

## 🧪 Tests

```bash
cd backend
pytest tests/ -v --cov=app
```

---

## 📁 Project Structure

```
PaperLens/
├── backend/
│   ├── app/
│   │   ├── agents/          # LangGraph orchestrator + LLM clients
│   │   ├── routers/         # FastAPI endpoints
│   │   └── utils/           # RAG, plagiarism, email, observability
│   └── tests/               # pytest test suite
├── frontend/
│   └── src/
│       ├── components/      # React UI components
│       └── pages/           # Route pages
└── .github/workflows/       # CI/CD (GitHub Actions + Codecov)
```

---

## 🛠️ Tech Stack

**Backend:** FastAPI · LangGraph · ChromaDB · SQLAlchemy · Groq  
**Frontend:** React 18 · TypeScript · Vite · Tailwind CSS  
**Integrations:** OpenAlex · Gmail SMTP · Render · Vercel  
**CI/CD:** GitHub Actions · Codecov  

---

## 📄 License

MIT © 2026 Prajwal K
