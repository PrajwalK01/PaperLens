# PeerForge Deployment & Testing Guide

Complete guide for testing, deploying, and monitoring PeerForge in development and production environments.

## Table of Contents
1. [Development Setup](#development-setup)
2. [Testing](#testing)
3. [Docker Deployment](#docker-deployment)
4. [Production Checklist](#production-checklist)
5. [Monitoring & Troubleshooting](#monitoring--troubleshooting)

---

## Development Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker & Docker Compose (for local testing with database)
- Git

### Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env from template
cp .env.example .env  # already done, but here for reference

# Edit .env with your API keys
# ANTHROPIC_API_KEY=sk-...
# OPENAI_API_KEY=sk-...
# GOOGLE_API_KEY=...

# Generate secure SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Add the output to .env as SECRET_KEY=...

# Run migrations (if using PostgreSQL)
# alembic upgrade head  # optional if migrations exist

# Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Backend URL**: `http://localhost:8000`  
**API Docs**: `http://localhost:8000/docs`

### Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Create .env.local
cp .env.example .env.local  # or create it manually

# Ensure .env.local contains:
# VITE_API_BASE=http://localhost:8000

# Start development server
npm run dev
```

**Frontend URL**: `http://localhost:5173`

### Verify Connection

1. Open `http://localhost:5173` in browser
2. You should see the login screen
3. Sign up as a new user (first user becomes admin)
4. Upload a paper or test review workflow
5. Check browser console (F12) for any API errors
6. Check backend logs for incoming requests

---

## Testing

### Manual Testing Checklist

#### Authentication
- [ ] Register new user account
- [ ] Login with correct credentials
- [ ] Login with wrong password (should fail)
- [ ] Access protected route without token (should redirect to login)
- [ ] Logout and token cleared from localStorage

#### Paper Upload
- [ ] Upload PDF file (< 50MB)
- [ ] PDF metadata extracted correctly
- [ ] Fetch paper from arXiv by ID
- [ ] Error handling for invalid files
- [ ] Error handling for network failures

#### Review Workflow
- [ ] Start review with default model config
- [ ] Start review with custom model selection
- [ ] WebSocket connection established (check Network tab)
- [ ] Real-time progress updates received
- [ ] Review completed and scores displayed
- [ ] Error handling if review fails

#### Dashboard
- [ ] User stats loading correctly
- [ ] Papers list shows recent uploads
- [ ] Activity timeline displays events
- [ ] Charts load without errors

#### Admin Dashboard
- [ ] Only accessible to admin users
- [ ] Stats display real data from backend
- [ ] System health indicators accurate
- [ ] Active models list populated

### Automated Testing (Optional)

```bash
# Backend: Run pytest (if tests exist)
cd backend
pytest

# Frontend: Run vitest
cd frontend
npm run test
```

### Load Testing

```bash
# Test with Apache Bench (simple endpoint)
ab -n 100 -c 10 http://localhost:8000/health

# Test review endpoint with wrk (requires installation)
wrk -t4 -c100 -d30s http://localhost:8000/api/papers
```

---

## Docker Deployment

### Local Docker Development

```bash
# Build and start all services
docker-compose up --build

# Access services:
# - Frontend: http://localhost:5173
# - Backend: http://localhost:8000
# - Docs: http://localhost:8000/docs
# - Database: localhost:5432 (internal only)

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop services
docker-compose down

# Remove volumes (reset database)
docker-compose down -v
```

### Production Docker Build

```bash
# Build production images
docker build -t peerforge-backend:latest ./backend
docker build -t peerforge-frontend:latest ./frontend

# Tag for registry (example: Docker Hub)
docker tag peerforge-backend:latest username/peerforge-backend:latest
docker tag peerforge-frontend:latest username/peerforge-frontend:latest

# Push to registry
docker push username/peerforge-backend:latest
docker push username/peerforge-frontend:latest
```

### Docker Environment Variables

**Backend (.env in docker container)**:
```env
DATABASE_URL=postgresql://peerforge:secure_password@db:5432/peerforge
SECRET_KEY=your-secure-random-key
ANTHROPIC_API_KEY=sk-...
OPENAI_API_KEY=sk-...
```

**Frontend (via docker-compose environment)**:
```yaml
frontend:
  environment:
    VITE_API_BASE: http://backend:8000
```

---

## Cloud Deployment (Render / Fly.io / Railway)

### The RAM reality check — read this before picking a plan

This backend loads torch + torchvision (CNN figure analysis) and chromadb
+ sentence-transformers (RAG embeddings) into memory. Loaded together,
that's realistically **800MB-1.5GB of RAM** before serving a single
request. Most free tiers (Render free = 512MB, Railway free trial ≈
512MB-1GB) will OOM-crash on startup or on the first request that
triggers a model load. Three honest paths:

1. **Pay for a small instance (~$5-7/mo)** — Render Starter, Railway
   Hobby, or Fly.io with 1GB RAM (see `fly.toml` in repo root) all
   comfortably fit the full feature set. Cheap enough that this is the
   recommended path for a real demo link you'd put on a resume.
2. **Free tier + `ENABLE_CNN_FIGURES=false`** — skips loading
   torch/torchvision entirely (the import in `papers.py` is lazy, so this
   genuinely saves the memory, not just CPU time). You lose figure
   duplicate-detection; chunking/RAG/plagiarism/AI-text checks and the
   full multi-agent review pipeline still work. Still worth testing
   before relying on it — chromadb + sentence-transformers alone can be
   tight on a true 512MB tier.
3. **Fly.io's free allowance** — `fly.toml` sets
   `auto_stop_machines = true` / `min_machines_running = 0`, so it scales
   to zero when idle, which stretches a free allowance a lot for a demo
   that isn't under constant load. Verify Fly's current free-tier terms
   before relying on this — they change.

### Deploying

**Render:** `render.yaml` in the repo root is a Blueprint — connect the
GitHub repo in the Render dashboard and it's picked up automatically.
Set the `sync: false` env vars (`FRONTEND_URL`, `VITE_API_URL`) manually
once you know both deployed service URLs.

**Fly.io:**
```bash
fly launch --dockerfile backend/Dockerfile --name paperlens-backend
fly secrets set SECRET_KEY=... DATABASE_URL=... ANTHROPIC_API_KEY=...
fly deploy
```

**Railway:** no extra config needed — it auto-detects `backend/Dockerfile`.
Add the same environment variables listed below via the dashboard.

### Extra env vars beyond what's above

- `FRONTEND_URL` — your deployed frontend's URL, so CORS allows it (see `app/main.py`)
- `ENABLE_CNN_FIGURES` — `true`/`false`, see RAM discussion above
- `AGENTIC_RAG_ENABLED` — `true`/`false`, agentic RAG vs. plain full-text prompts
- `RATE_LIMIT_DEFAULT` — defaults to `60/minute`; the review-creation and
  upload endpoints have their own stricter limits (5/min and 10/min)
  regardless of this default — see `app/rate_limiter.py` and
  `THREAT_MODEL.md`

### A note on Ollama in production

If any `AGENT_MODEL_*` role points at Ollama, remember a deployed server
has no access to your laptop's Ollama instance — that role will fail in
production unless you either switch its deployed config to a hosted
provider (simplest), or run Ollama as its own service alongside the app
(possible, but adds its own memory budget on top of everything above).

---

## Production Checklist

### Security (CRITICAL)
- [ ] `SECRET_KEY` set to a strong random value (not the default)
- [ ] All API keys stored in environment variables (not in code)
- [ ] Database URL uses PostgreSQL (not SQLite)
- [ ] HTTPS enabled on frontend and backend
- [ ] CORS origins restricted to allowed domains only
- [ ] Rate limiting configured
- [ ] Password requirements enforced (already done with validators)
- [ ] Database backups configured

### Performance
- [ ] Database connection pooling configured
- [ ] Caching headers set on static assets
- [ ] Frontend built for production: `npm run build`
- [ ] Static assets served from CDN (optional)
- [ ] Load balancer configured (if multi-instance)
- [ ] Database indexes created on frequently queried columns

### Monitoring
- [ ] Error tracking configured (e.g., Sentry)
- [ ] Application logs centralized (e.g., ELK, Datadog)
- [ ] Uptime monitoring enabled
- [ ] Performance metrics tracked
- [ ] Alert thresholds configured

### Operations
- [ ] Database migration strategy documented
- [ ] Rollback procedure documented
- [ ] Backup and restore tested
- [ ] Admin access restricted to specific users
- [ ] API documentation updated
- [ ] Dependencies updated and scanned for vulnerabilities

### Deployment Process

1. **Prepare**:
   ```bash
   # Test thoroughly in staging
   # Run security scan
   docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image peerforge-backend:latest
   ```

2. **Build**:
   ```bash
   # Build production images
   docker build -t peerforge-backend:v1.0.0 ./backend
   ```

3. **Tag & Push**:
   ```bash
   # Tag with version
   docker tag peerforge-backend:v1.0.0 registry.example.com/peerforge-backend:v1.0.0
   docker push registry.example.com/peerforge-backend:v1.0.0
   ```

4. **Deploy**:
   ```bash
   # Update docker-compose or K8s manifests
   # Deploy to production cluster
   # Monitor logs and metrics
   ```

5. **Verify**:
   ```bash
   # Health check
   curl https://api.example.com/health
   
   # Test key workflows
   # Monitor error rates
   ```

---

## Monitoring & Troubleshooting

### Health Checks

```bash
# Backend health
curl http://localhost:8000/health

# Expected response:
{
  "status": "ok",
  "service": "PaperLens",
  "database": "sqlite",
  "database_connected": true
}
```

### Common Issues

#### 1. Frontend can't connect to backend
**Symptoms**: API calls fail, CORS errors in console

**Solutions**:
- Check `VITE_API_BASE` environment variable
- Verify backend is running on expected port
- Check backend CORS configuration includes frontend origin
- Check network connectivity between services (in Docker)

```bash
# Verify backend is responding
curl -v http://localhost:8000/health

# Check API route exists
curl -v http://localhost:8000/api/papers
```

#### 2. WebSocket connection fails
**Symptoms**: Review progress not updating, polling fallback

**Solutions**:
- Verify WebSocket proxy configured in Vite (if using dev server)
- Check firewall allows WebSocket connections
- Verify job ID is valid

```bash
# Test WebSocket manually (requires wscat)
npm install -g wscat
wscat -c ws://localhost:8000/ws/review/job-123
```

#### 3. Review job fails with LLM error
**Symptoms**: Review status shows "failed", error_message in response

**Solutions**:
- Verify API key configured in `.env`
- Check API key has sufficient quota
- Check model name is correct for provider
- Review backend logs for detailed error

```bash
# Check logs
docker-compose logs backend | grep -i error

# Test LLM connection manually
python -c "from langchain_openai import ChatOpenAI; ChatOpenAI().invoke('test')"
```

#### 4. Database connection errors
**Symptoms**: 500 errors, "database is locked", "connection refused"

**Solutions**:
- Verify `DATABASE_URL` is correct
- Check database service is running
- Check credentials are correct
- Check port is accessible
- For SQLite: ensure no other process has exclusive lock

```bash
# PostgreSQL: test connection
psql postgresql://user:pass@localhost:5432/dbname

# SQLite: verify file exists
ls -la backend/peerforge.db
```

#### 5. High memory usage
**Symptoms**: Application slows down, out of memory errors

**Solutions**:
- Check database connection pool size
- Monitor review job queue depth
- Check for memory leaks in background tasks
- Increase container memory limit

```bash
# Monitor memory in Docker
docker stats peerforge-backend

# Check Python memory
python -m memory_profiler app/main.py
```

### Logging

**Backend logs**:
```bash
# View recent logs
docker-compose logs -f backend --tail=100

# Search for errors
docker-compose logs backend | grep ERROR

# Export logs
docker-compose logs backend > backend.log
```

**Frontend logs**:
- Browser console (F12)
- Network tab for API calls
- Application tab for localStorage

### Performance Metrics

Monitor these KPIs:
- API response times (target: < 200ms for most endpoints)
- Review completion time (varies, typically 2-5 minutes)
- Database query times (target: < 100ms)
- WebSocket message latency (target: < 500ms)
- Error rate (target: < 0.1%)
- Resource utilization (CPU, memory, disk)

### Backup & Restore

**PostgreSQL**:
```bash
# Backup database
pg_dump -U peerforge -d peerforge > backup.sql

# Restore database
psql -U peerforge -d peerforge < backup.sql
```

**SQLite**:
```bash
# Backup database file
cp backend/peerforge.db backup.db

# Restore from backup
cp backup.db backend/peerforge.db
```

### Update & Maintenance

```bash
# Update Python dependencies
pip install --upgrade -r backend/requirements.txt

# Update Node dependencies
npm update

# Check for security vulnerabilities
npm audit
pip check

# Clean up old Docker images
docker image prune -a
```

---

## Support & Documentation

- **API Documentation**: `http://localhost:8000/docs`
- **Backend README**: [backend/README.md](backend/README.md)
- **Frontend README**: [frontend/README.md](frontend/README.md)
- **GitHub Issues**: Report bugs and feature requests
- **Contributing**: See CONTRIBUTING.md for development guidelines

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01 | Initial release with multi-agent review system |

---

**Last Updated**: 2024-01-XX  
**Maintained By**: PeerForge Team
