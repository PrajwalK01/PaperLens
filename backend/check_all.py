"""Quick health check for all PaperAI features."""
import sys, os
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv()

results = []

def ok(name): results.append(('PASS', name)); print(f'  OK  {name}')
def fail(name, err): results.append(('FAIL', name)); print(f'  FAIL {name}: {err[:80]}')

print('=== PaperAI Health Check ===\n')

# 1. Core
print('[1] Core imports')
try:
    from app.main import app
    ok('FastAPI app')
except Exception as e: fail('FastAPI app', str(e))

try:
    from app.agents.orchestrator import build_graph
    g = build_graph()
    ok('LangGraph orchestrator')
except Exception as e: fail('LangGraph orchestrator', str(e))

try:
    from app.agents.llm_clients import _defaults
    d = _defaults()
    ok(f'Group A: {d["group_a_primary"][:40]}')
    ok(f'Group B: {d["group_b_primary"][:40]}')
except Exception as e: fail('LLM clients', str(e))

# 2. Database
print('\n[2] Database')
try:
    from app.database import check_connection
    if check_connection(): ok('SQLite connected')
    else: fail('SQLite', 'check_connection() returned False')
except Exception as e: fail('Database', str(e))

# 3. Security
print('\n[3] Security')
try:
    from app.utils.security import get_password_hash, verify_password
    h = get_password_hash('testpass')
    assert verify_password('testpass', h)
    ok('Password hash/verify (bcrypt)')
except Exception as e: fail('Security', str(e))

# 4. Email / SMTP
print('\n[4] Email')
smtp_ok = bool(os.getenv('SMTP_HOST','').strip()) and bool(os.getenv('SMTP_PASSWORD','').strip())
if smtp_ok: ok('SMTP configured')
else: fail('SMTP', 'SMTP_HOST or SMTP_PASSWORD not set')

# 5. Plagiarism / AI-text detection
print('\n[5] Integrity checks')
try:
    from app.utils.plagiarism import heuristic_ai_text_score
    s = heuristic_ai_text_score('Test sentence one. Test two. Three. Four. Five. Six. Seven. Eight.')
    ok(f'AI-text heuristic (score={s})')
except Exception as e: fail('AI-text heuristic', str(e))

try:
    from app.utils.plagiarism import check_similarity
    r = check_similarity('nonexistent-paper-id')
    ok('Plagiarism similarity check')
except Exception as e: fail('Plagiarism', str(e))

# 6. Observability
print('\n[6] Observability')
try:
    from app.utils import observability
    events = observability.get_trace_for_job('nonexistent')
    ok(f'Observability traces (found {len(events)} events for test id)')
except Exception as e: fail('Observability', str(e))

# 7. Cost tracker
print('\n[7] Cost tracker')
try:
    from app.utils import cost_tracker
    class FakeResp:
        usage = None
    usage = cost_tracker.extract_usage_from_response(FakeResp(), 'groq', fallback_char_count=500)
    ok(f'Cost tracker (estimated={usage.get("estimated_cost_usd", "?")})')
except Exception as e: fail('Cost tracker', str(e))

# 8. CNN figures module
print('\n[8] CNN figures')
try:
    if os.getenv('ENABLE_CNN_FIGURES', 'true').lower() == 'true':
        from app.utils import cnn_figures
        ok('CNN figures module (ENABLE_CNN_FIGURES=true)')
    else:
        ok('CNN figures DISABLED (ENABLE_CNN_FIGURES=false) - expected for free tier')
except Exception as e: fail('CNN figures', str(e))

# 9. Chunking / RAG
print('\n[9] RAG / Chunking')
try:
    from app.utils import chunking
    ids = chunking.list_indexed_paper_ids()
    ok(f'ChromaDB connected ({len(ids)} papers indexed)')
except Exception as e: fail('ChromaDB', str(e))

# 10. Rate limiter
print('\n[10] Rate limiting')
try:
    from app.rate_limiter import limiter
    ok('SlowAPI rate limiter')
except Exception as e: fail('Rate limiter', str(e))

# Summary
print('\n' + '='*40)
passed = sum(1 for r in results if r[0]=='PASS')
failed = sum(1 for r in results if r[0]=='FAIL')
print(f'RESULT: {passed}/{passed+failed} checks passed')
if failed:
    print('FAILED:')
    for r in results:
        if r[0] == 'FAIL':
            print(f'  - {r[1]}')
else:
    print('All systems operational!')
