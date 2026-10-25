"""
test_cache_service.py — In-memory TTL cache unit tests.

Covers:
  - Basic get/set.
  - TTL expiry.
  - delete and delete_pattern.
  - Thread-safety (concurrent access).
  - User-scoped key isolation.
"""

import time
import threading
import pytest

from app.services.cache import TTLCache


# ---------------------------------------------------------------------------
# 1. BASIC OPERATIONS
# ---------------------------------------------------------------------------

class TestTTLCacheBasic:

    def test_set_and_get(self):
        c = TTLCache()
        c.set("key1", "value1")
        assert c.get("key1") == "value1"

    def test_get_missing_key_returns_none(self):
        c = TTLCache()
        assert c.get("nonexistent") is None

    def test_set_overwrites_existing(self):
        c = TTLCache()
        c.set("key", "original")
        c.set("key", "updated")
        assert c.get("key") == "updated"

    def test_set_dict_value(self):
        c = TTLCache()
        data = {"topics": ["ML", "Data"], "count": 42}
        c.set("analysis:user:1", data)
        assert c.get("analysis:user:1") == data

    def test_size_increases_on_set(self):
        c = TTLCache()
        c.set("k1", "v1")
        c.set("k2", "v2")
        assert c.size == 2

    def test_delete_removes_key(self):
        c = TTLCache()
        c.set("key", "val")
        c.delete("key")
        assert c.get("key") is None

    def test_delete_missing_key_is_safe(self):
        c = TTLCache()
        c.delete("nonexistent")  # must not raise

    def test_clear_removes_all(self):
        c = TTLCache()
        for i in range(10):
            c.set(f"key{i}", i)
        c.clear()
        assert c.size == 0
        for i in range(10):
            assert c.get(f"key{i}") is None


# ---------------------------------------------------------------------------
# 2. TTL EXPIRY
# ---------------------------------------------------------------------------

class TestTTLExpiry:

    def test_entry_expires_after_ttl(self):
        c = TTLCache()
        c.set("expiring", "value", ttl=1)
        assert c.get("expiring") == "value"
        time.sleep(1.1)
        assert c.get("expiring") is None

    def test_size_decreases_after_expiry(self):
        c = TTLCache()
        c.set("expire_me", "v", ttl=1)
        c.set("keep_me", "v2", ttl=60)
        time.sleep(1.1)
        c.evict_expired()
        assert c.size == 1

    def test_zero_ttl_expires_immediately(self):
        c = TTLCache()
        c.set("instant_expire", "v", ttl=0)
        # Immediately after setting, the entry should already be expired
        time.sleep(0.01)
        assert c.get("instant_expire") is None

    def test_evict_expired_returns_count(self):
        c = TTLCache()
        c.set("e1", "v", ttl=1)
        c.set("e2", "v", ttl=1)
        c.set("keep", "v", ttl=60)
        time.sleep(1.1)
        count = c.evict_expired()
        assert count == 2


# ---------------------------------------------------------------------------
# 3. DELETE PATTERN
# ---------------------------------------------------------------------------

class TestDeletePattern:

    def test_delete_pattern_removes_matching_keys(self):
        c = TTLCache()
        c.set("user:1:interests", "data_a")
        c.set("user:1:dashboard", "data_b")
        c.set("user:2:interests", "data_c")
        deleted = c.delete_pattern("user:1")
        assert deleted == 2
        assert c.get("user:1:interests") is None
        assert c.get("user:1:dashboard") is None
        assert c.get("user:2:interests") == "data_c"

    def test_delete_pattern_no_matches_returns_zero(self):
        c = TTLCache()
        c.set("other_key", "val")
        deleted = c.delete_pattern("user:99")
        assert deleted == 0

    def test_delete_pattern_empty_cache(self):
        c = TTLCache()
        deleted = c.delete_pattern("any:prefix")
        assert deleted == 0


# ---------------------------------------------------------------------------
# 4. USER SCOPING (INTEGRATION)
# ---------------------------------------------------------------------------

class TestUserScopedCache:
    """Simulate the application pattern where cache keys include user ID."""

    def test_different_users_isolated(self):
        c = TTLCache()
        c.set("user:1:analysis", {"interests": ["ML"]})
        c.set("user:2:analysis", {"interests": ["Music"]})
        assert c.get("user:1:analysis") == {"interests": ["ML"]}
        assert c.get("user:2:analysis") == {"interests": ["Music"]}

    def test_clearing_user1_does_not_affect_user2(self):
        c = TTLCache()
        c.set("user:1:analysis", "u1_data")
        c.set("user:2:analysis", "u2_data")
        c.delete_pattern("user:1")
        assert c.get("user:1:analysis") is None
        assert c.get("user:2:analysis") == "u2_data"


# ---------------------------------------------------------------------------
# 5. THREAD SAFETY
# ---------------------------------------------------------------------------

class TestThreadSafety:

    def test_concurrent_sets_no_crash(self):
        c = TTLCache()
        errors = []

        def writer(key_suffix: int):
            try:
                for i in range(50):
                    c.set(f"key_{key_suffix}_{i}", i)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=writer, args=(t,)) for t in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert errors == [], f"Thread errors: {errors}"

    def test_concurrent_reads_writes_no_crash(self):
        c = TTLCache()
        c.set("shared_key", "initial_value")
        errors = []

        def reader():
            try:
                for _ in range(100):
                    c.get("shared_key")
            except Exception as e:
                errors.append(e)

        def writer():
            try:
                for i in range(100):
                    c.set("shared_key", f"value_{i}")
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=reader) for _ in range(3)]
        threads += [threading.Thread(target=writer) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert errors == [], f"Concurrent errors: {errors}"
