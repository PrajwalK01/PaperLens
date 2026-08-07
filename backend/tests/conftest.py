"""
Test configuration. Stubs out chromadb at import time ONLY for test runs
that don't need real vector-store behavior (test_chunking.py's pure logic
tests, test_plagiarism.py's heuristic scorer, etc.). Tests that actually
need a working Chroma instance should install the real dependency and can
ignore/override this stub locally.

This exists so `pytest` runs cleanly in lightweight CI/dev environments
without requiring the full chromadb + sentence-transformers + torch stack
just to check that section-splitting and scoring logic is correct.
"""

import sys
import types


def _install_chromadb_stub():
    if "chromadb" in sys.modules:
        return  # real chromadb is installed and already imported — don't override it

    try:
        import chromadb  # noqa: F401
        return  # real package available, no stub needed
    except ImportError:
        pass

    chromadb_stub = types.ModuleType("chromadb")

    class _FakePersistentClient:
        def __init__(self, *a, **kw):
            pass

        def get_or_create_collection(self, *a, **kw):
            raise NotImplementedError("Stub client — install real chromadb for vector-store tests")

        def get_collection(self, *a, **kw):
            raise NotImplementedError("Stub client — install real chromadb for vector-store tests")

        def list_collections(self):
            return []

        def delete_collection(self, *a, **kw):
            pass

    chromadb_stub.PersistentClient = _FakePersistentClient

    utils_stub = types.ModuleType("chromadb.utils")
    embedding_functions_stub = types.ModuleType("chromadb.utils.embedding_functions")

    class _FakeEmbeddingFunction:
        def __init__(self, *a, **kw):
            pass

    embedding_functions_stub.SentenceTransformerEmbeddingFunction = _FakeEmbeddingFunction
    utils_stub.embedding_functions = embedding_functions_stub

    sys.modules["chromadb"] = chromadb_stub
    sys.modules["chromadb.utils"] = utils_stub
    sys.modules["chromadb.utils.embedding_functions"] = embedding_functions_stub


_install_chromadb_stub()
