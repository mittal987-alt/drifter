"""
Simple in-memory TTL cache for analytics results.

Usage:
    from app.services.cache import cache

    result = cache.get("dashboard:42")
    if result is None:
        result = expensive_compute()
        cache.set("dashboard:42", result, ttl=300)
"""

import time
import logging
from threading import Lock
from typing import Any, Optional

logger = logging.getLogger(__name__)


class TTLCache:
    """Thread-safe in-memory cache with time-to-live eviction."""

    def __init__(self, default_ttl: int = 300) -> None:
        self._store: dict[str, tuple[Any, float]] = {}
        self._lock = Lock()
        self.default_ttl = default_ttl

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if time.monotonic() > expires_at:
                del self._store[key]
                logger.debug("Cache MISS (expired): %s", key)
                return None
            logger.debug("Cache HIT: %s", key)
            return value

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        effective_ttl = ttl if ttl is not None else self.default_ttl
        expires_at = time.monotonic() + effective_ttl
        with self._lock:
            self._store[key] = (value, expires_at)
        logger.debug("Cache SET: %s (ttl=%ds)", key, effective_ttl)

    def delete(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    def delete_pattern(self, prefix: str) -> int:
        """Delete all keys starting with prefix. Returns number deleted."""
        with self._lock:
            to_delete = [k for k in self._store if k.startswith(prefix)]
            for k in to_delete:
                del self._store[k]
        return len(to_delete)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()

    def evict_expired(self) -> int:
        """Remove all expired entries. Returns count removed."""
        now = time.monotonic()
        with self._lock:
            to_delete = [k for k, (_, exp) in self._store.items() if now > exp]
            for k in to_delete:
                del self._store[k]
        return len(to_delete)

    @property
    def size(self) -> int:
        with self._lock:
            return len(self._store)


# Application-level singleton — import this everywhere
cache = TTLCache(default_ttl=300)  # 5-minute default TTL
