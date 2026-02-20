"""
Session store with Redis backend and in-memory fallback.

Stores intermediate pipeline results between ingest and interpret calls.
"""

from __future__ import annotations

import json
import logging
import os
import pickle
from typing import Any, Optional

logger = logging.getLogger(__name__)


class RedisSessionStore:
    """Redis-backed session store."""

    def __init__(self, redis_url: str, ttl_seconds: int = 3600):
        import redis
        self.client = redis.from_url(redis_url)
        self.ttl = ttl_seconds
        logger.info(f"Redis session store connected: {redis_url}")

    def save(self, session_id: str, data: dict) -> None:
        """Save session data to Redis."""
        # Serialize with pickle for numpy array support
        serialized = pickle.dumps(data)
        self.client.setex(f"session:{session_id}", self.ttl, serialized)

    def load(self, session_id: str) -> Optional[dict]:
        """Load session data from Redis."""
        raw = self.client.get(f"session:{session_id}")
        if raw is None:
            return None
        return pickle.loads(raw)

    def delete(self, session_id: str) -> None:
        """Delete a session."""
        self.client.delete(f"session:{session_id}")

    def exists(self, session_id: str) -> bool:
        """Check if a session exists."""
        return bool(self.client.exists(f"session:{session_id}"))


class InMemorySessionStore:
    """In-memory fallback session store for development."""

    def __init__(self, max_sessions: int = 100):
        self._store: dict[str, dict] = {}
        self._max = max_sessions
        logger.info("Using in-memory session store (no Redis)")

    def save(self, session_id: str, data: dict) -> None:
        # Evict oldest if at capacity
        if len(self._store) >= self._max and session_id not in self._store:
            oldest = next(iter(self._store))
            del self._store[oldest]
        self._store[session_id] = data

    def load(self, session_id: str) -> Optional[dict]:
        return self._store.get(session_id)

    def delete(self, session_id: str) -> None:
        self._store.pop(session_id, None)

    def exists(self, session_id: str) -> bool:
        return session_id in self._store


def create_session_store() -> RedisSessionStore | InMemorySessionStore:
    """Create the appropriate session store based on environment."""
    redis_url = os.environ.get("REDIS_URL")

    if redis_url:
        try:
            store = RedisSessionStore(redis_url)
            # Test connection
            store.client.ping()
            return store
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}; falling back to in-memory store")

    return InMemorySessionStore()


# Module-level singleton
session_store = create_session_store()
