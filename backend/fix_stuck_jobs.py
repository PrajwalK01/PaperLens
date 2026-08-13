from dotenv import load_dotenv; load_dotenv()
import sys; sys.path.insert(0,'.')
from app.database import engine
from sqlalchemy import text
with engine.connect() as c:
    r = c.execute(text(
        "UPDATE review_jobs SET status='failed', error_message='Interrupted - server restart' WHERE status='processing'"
    ))
    c.commit()
    print(f'Fixed {r.rowcount} stuck jobs')
