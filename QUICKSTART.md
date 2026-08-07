# PeerForge Quick Start Guide

Fast reference for developers getting started with PeerForge.

## 🚀 5-Minute Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
# Backend ready at http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Frontend ready at http://localhost:5173
```

### Verify
```bash
# Both running?
curl http://localhost:8000/health        # Should return {"status": "ok", ...}
open http://localhost:5173               # Browser should load app
```

---

## 📋 Development Workflow

### Start New Feature
```bash
# Backend
cd backend
git checkout -b feature/your-feature
# Edit files in app/
# Add tests if applicable

# Frontend  
cd frontend
git checkout -b feature/your-feature
# Edit files in src/
# Run npm run dev to see changes live
```

### Common Tasks

**Add API Endpoint**:
```python
# backend/app/routers/your_router.py
from fastapi import APIRouter, Depends
from app.database import get_db
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/your-resource", tags=["your-resource"])

@router.get("/{id}")
def get_item(id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return {"id": id, "user": current_user.username}

# Add to app/main.py:
# app.include_router(your_router.router)
```

**Call Backend from Frontend**:
```typescript
// frontend/src/api.ts
export async function getItem(id: string) {
  const res = await api.get(`/api/your-resource/${id}`);
  return res.data;
}

// In component:
import { getItem } from '../api';

function MyComponent() {
  const [data, setData] = useState(null);
  useEffect(() => {
    getItem('123').then(setData);
  }, []);
  return <div>{JSON.stringify(data)}</div>;
}
```

**Add Database Model**:
```python
# backend/app/models.py
from sqlalchemy import Column, String, DateTime, ForeignKey
from app.database import Base
import uuid
from datetime import datetime

class MyModel(Base):
    __tablename__ = "my_model"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    user_id = Column(String, ForeignKey("user.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
```

---

## 🧪 Testing

### Run Tests
```bash
# Backend (if tests exist)
cd backend
pytest

# Frontend
cd frontend
npm run test
```

### Manual API Testing
```bash
# Health check
curl http://localhost:8000/health

# Interactive docs
open http://localhost:8000/docs

# Login and get token
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=demo_user&password=demopass123"

# Use token in requests
TOKEN="eyJ0eXAiOiJKV1QiLCJhbGc..."
curl http://localhost:8000/api/auth/me -H "Authorization: Bearer $TOKEN"
```

---

## 🐛 Debugging

### Backend
```bash
# Check logs
docker-compose logs -f backend

# Debug Python
python -m pdb app/main.py
# Set breakpoint: breakpoint()

# Database query
from app.database import get_db
db = next(get_db())
db.query(User).all()
```

### Frontend
```bash
# Browser console (F12)
# Network tab: see API calls
# Application tab: check localStorage for token

# Debug React component
// Add to component:
console.log('Component mounted', props);

// Use React DevTools browser extension
```

### Docker Issues
```bash
# See what's running
docker-compose ps

# Check service logs
docker-compose logs backend
docker-compose logs frontend

# SSH into container
docker-compose exec backend /bin/bash
docker-compose exec frontend /bin/sh

# Restart service
docker-compose restart backend
```

---

## 📁 Project Structure Quick Ref

```
PeerForge/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app setup
│   │   ├── database.py          # SQLAlchemy setup
│   │   ├── models.py            # Database models (User, Paper, ReviewJob, etc)
│   │   ├── schemas.py           # Pydantic schemas (validation)
│   │   ├── routers/
│   │   │   ├── auth.py          # Login, register, user endpoints
│   │   │   ├── papers.py        # Upload, fetch paper endpoints
│   │   │   ├── review.py        # Start review, get results endpoints
│   │   │   └── stats.py         # Dashboard stats endpoints
│   │   ├── agents/
│   │   │   ├── orchestrator.py  # LangGraph review workflow
│   │   │   ├── llm_clients.py   # Multi-provider LLM setup
│   │   │   └── prompts.py       # System/role prompts
│   │   ├── utils/
│   │   │   ├── security.py      # Auth utilities
│   │   │   ├── pdf_parser.py    # PDF text extraction
│   │   │   └── arxiv_fetcher.py # arXiv API client
│   │   └── ws_manager.py        # WebSocket broadcasting
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env                     # Configuration (not in git)
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx             # React entry point
│   │   ├── App.tsx              # Main app component
│   │   ├── api.ts               # API client (Axios)
│   │   ├── pages/
│   │   │   ├── Home.tsx         # Upload & model selection
│   │   │   ├── ReviewDashboard  # Real-time review progress
│   │   │   ├── UserDashboard    # User stats & history
│   │   │   ├── History.tsx      # Past reviews
│   │   │   └── AdminDashboard   # System monitoring
│   │   ├── components/
│   │   │   ├── ProgressTracker  # Review progress display
│   │   │   ├── FinalVerdict     # Review results
│   │   │   ├── UploadForm       # PDF/arXiv upload
│   │   │   └── Layout.tsx       # Navigation & layout
│   │   └── index.css            # Tailwind CSS
│   ├── package.json
│   ├── vite.config.ts
│   ├── Dockerfile
│   └── .env.local               # Dev API base URL
│
├── docker-compose.yml           # Multi-container setup
├── README.md                    # Project overview
├── SETUP.md                     # Connection setup
├── DEPLOYMENT.md                # Testing & deployment
└── IMPROVEMENTS.md              # Changes summary
```

---

## 🔑 Key Files to Know

| File | Purpose | When to Edit |
|------|---------|--------------|
| `backend/app/main.py` | FastAPI setup, CORS | Add new routers, middleware |
| `backend/app/models.py` | Database schema | Add new data models |
| `backend/app/routers/auth.py` | Authentication | Auth logic, permissions |
| `frontend/src/api.ts` | API client | Add new API methods |
| `docker-compose.yml` | Container setup | Change ports, add services |
| `.env` | Configuration | API keys, database URL |

---

## 📚 Useful Commands

```bash
# Docker
docker-compose up                  # Start all services
docker-compose up --build          # Rebuild images
docker-compose down                # Stop all services
docker-compose ps                  # Show running containers
docker-compose logs -f [service]   # Follow logs

# Backend
uvicorn app.main:app --reload     # Dev server with hot reload
python -m pytest                   # Run tests
pip install -r requirements.txt    # Install dependencies

# Frontend
npm run dev                        # Dev server with hot reload
npm run build                      # Production build
npm run test                       # Run tests
npm run lint                       # Run linter

# Git
git checkout -b feature/xyz        # Create new branch
git add .                          # Stage changes
git commit -m "message"            # Commit
git push origin feature/xyz        # Push branch
```

---

## ⚠️ Common Gotchas

1. **CORS Errors**: Make sure backend origin is in `app.add_middleware(CORSMiddleware, allow_origins=[...])`

2. **API Not Found**: Did you add the router in `app/main.py`?
   ```python
   app.include_router(your_router.router)
   ```

3. **WebSocket Won't Connect**: Check browser Network tab (WS tab), verify backend WebSocket endpoint exists

4. **Database Locked (SQLite)**: Only one process can access SQLite at a time
   ```bash
   # Kill other processes
   lsof | grep PaperLens.db
   kill -9 <pid>
   ```

5. **Token Expired**: Tokens expire after 7 days by default (set in `.env`)

---

## 🚀 Next Steps

1. **Make First Change**: Edit `frontend/src/pages/Home.tsx`, change title
2. **Commit & Push**: `git add . && git commit -m "Update title"`
3. **Understand LangGraph**: Read `backend/app/agents/orchestrator.py`
4. **Add Feature**: Pick from [IMPROVEMENTS.md](IMPROVEMENTS.md)

---

**Happy coding! 🎉**

For more details, see:
- [SETUP.md](SETUP.md) - Connection setup
- [DEPLOYMENT.md](DEPLOYMENT.md) - Testing & deployment  
- [IMPROVEMENTS.md](IMPROVEMENTS.md) - What's been done
