"""
Shared slowapi Limiter instance. Defined here (not in main.py) so routers
can import it for endpoint-specific rate limits without a circular import
(main.py imports routers, so routers can't import from main.py).
"""

import os
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=[os.getenv("RATE_LIMIT_DEFAULT", "60/minute")])
