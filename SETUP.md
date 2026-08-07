# Frontend-Backend Connection Guide

This document explains how the PeerForge frontend and backend communicate.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser                                │
│  Frontend (React + Vite)                                         │
│  - Vite dev server on :5173                                      │
│  - API calls to VITE_API_BASE (http://localhost:8000 locally)   │
│  - WebSocket connections for real-time updates                   │
└─────────────┬──────────────────────────────────────────────────┘
              │
              │ HTTP/WebSocket
              │
┌─────────────▼──────────────────────────────────────────────────┐
│                     Backend (FastAPI)                           │
│  - Uvicorn on :8000                                             │
│  - CORS enabled for frontend origins                            │
│  - PostgreSQL database (docker-compose)                         │
│  - WebSocket support for real-time review updates               │
└──────────────────────────────────────────────────────────────────┘
```

## Local Development

### 1. Backend Setup

```bash
# Navigate to backend
cd backend

# Create/activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure .env (already created, but add your API keys)
# Edit backend/.env and add:
# - ANTHROPIC_API_KEY=your_key
# - OPENAI_API_KEY=your_key
# - GOOGLE_API_KEY=your_key
# - MISTRAL_API_KEY=your_key

# Run backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000`
- API docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

### 2. Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Frontend uses VITE_API_BASE environment variable
# For local dev, it defaults to http://localhost:8000 (see .env.local)

# Run dev server
npm run dev
```

The frontend will be available at `http://localhost:5173`

### 3. Test the Connection

1. Open `http://localhost:5173` in your browser
2. Upload a paper or test the review functionality
3. Check browser console (F12) for any API errors
4. Verify backend logs for incoming requests

## Docker Deployment

### Using docker-compose

```bash
# From project root
docker-compose up --build
```

This starts:
- **Backend**: `http://localhost:8000` (accessible from host)
- **Frontend**: `http://localhost:5173` (accessible from host)
- **Database**: PostgreSQL on port 5432 (internal only)

### Key Docker Configuration

In `docker-compose.yml`:
```yaml
frontend:
  environment:
    VITE_API_BASE: http://backend:8000  # Service name resolution in Docker
```

This allows the frontend container to reach the backend container using the service name `backend`.

### Important: CORS Configuration

The backend's CORS middleware in `app/main.py` allows:
- `http://localhost:5173` - Local frontend dev
- `http://localhost:3000` - Alternative local port
- `http://frontend:5173` - Docker service name
- `http://127.0.0.1:5173` - Localhost alternative

If you're running on a different host/port, add it to the `allow_origins` list.

## Environment Variables

### Backend (`.env`)

```env
# Database
DATABASE_URL=sqlite:///./peerforge.db  # or PostgreSQL URL for docker-compose

# LLM API Keys (add only what you need)
ANTHROPIC_API_KEY=your_key
OPENAI_API_KEY=your_key
GOOGLE_API_KEY=your_key
MISTRAL_API_KEY=your_key
```

### Frontend (`.env.local`)

```env
# API connection
VITE_API_BASE=http://localhost:8000
```

**Note:** `.env.local` is listed in `.gitignore` and won't be committed.

## API Endpoints

All frontend API calls go to the backend:

- **Auth**: `/api/auth/*` - Login, register, user info
- **Papers**: `/api/papers/*` - Upload PDF, fetch from arXiv
- **Reviews**: `/api/review/*` - Start review, get review results
- **Stats**: `/api/stats/*` - User stats, dashboard data
- **WebSocket**: `/ws/review/{jobId}` - Real-time review updates

See `frontend/src/api.ts` for the complete API client implementation.

## Troubleshooting

### Frontend can't connect to backend

1. **Check VITE_API_BASE**:
   - Local: Should be `http://localhost:8000`
   - Docker: Should be `http://backend:8000`
   - Check `frontend/.env.local` or browser console network tab

2. **Check CORS errors** (browser console):
   - Backend must have frontend origin in `allow_origins`
   - Restart backend after changing CORS config

3. **Check network connectivity**:
   - Local: Backend running on port 8000?
   - Docker: `docker-compose ps` - are all services running?
   - Docker: `docker-compose logs backend` - any backend errors?

### WebSocket connection fails

- WebSocket connects to same origin as HTTP API
- Check `VITE_API_BASE` is correct (will be converted from `http://` to `ws://`)
- WebSocket path: `/ws/review/{jobId}`

### Backend doesn't receive frontend requests

1. **Check backend is running**:
   ```bash
   curl http://localhost:8000/health
   ```

2. **Check frontend is using correct API base**:
   - Open DevTools → Network tab
   - Look at API request URLs
   - Should be `http://localhost:8000/api/...`

3. **Check CORS is configured**:
   ```bash
   # Backend logs should show CORS middleware
   # If getting CORS errors in browser, check app/main.py
   ```

## Production Deployment

For production:

1. **Set proper environment variables**:
   ```env
   VITE_API_BASE=https://your-api-domain.com
   ```

2. **Update CORS origins** in `backend/app/main.py`:
   ```python
   allow_origins=[
       "https://your-frontend-domain.com",
       "https://your-api-domain.com",
   ]
   ```

3. **Build frontend** for production:
   ```bash
   cd frontend
   npm run build
   # Output in frontend/dist - deploy to CDN or web server
   ```

4. **Run backend** with production settings (no reload):
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

## See Also

- [Frontend README](frontend/README.md) - Frontend-specific setup
- [Backend README](backend/README.md) - Backend-specific setup
- [docker-compose.yml](docker-compose.yml) - Full Docker configuration
