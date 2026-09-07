"""Per-API-key rate limiting for the metered /api proxy.

Held in process rather than Redis: the gateway runs as a single container
(network_mode: host in docker-compose.yml), and the counters are cheap to
rebuild on restart. Running more than one replica would need shared storage —
the limit would otherwise be per-replica.
"""

import os
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, status

# Requests allowed per key within the window.
RATE_LIMIT_REQUESTS = int(os.environ.get("RATE_LIMIT_REQUESTS", "60"))
RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("RATE_LIMIT_WINDOW_SECONDS", "60"))

_hits: dict[str, deque] = defaultdict(deque)
_lock = Lock()


def _prune(timestamps: deque, now: float) -> None:
    cutoff = now - RATE_LIMIT_WINDOW_SECONDS
    while timestamps and timestamps[0] <= cutoff:
        timestamps.popleft()


def check_rate_limit(key: str) -> None:
    """Record a request for `key`, raising 429 once the window is full."""
    if RATE_LIMIT_REQUESTS <= 0:  # 0 disables the limiter
        return

    now = time.monotonic()
    with _lock:
        timestamps = _hits[key]
        _prune(timestamps, now)

        if len(timestamps) >= RATE_LIMIT_REQUESTS:
            retry_after = max(
                1, int(RATE_LIMIT_WINDOW_SECONDS - (now - timestamps[0])) + 1
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=[
                    {
                        "field": "rate_limit",
                        "message": (
                            f"Rate limit exceeded: {RATE_LIMIT_REQUESTS} requests "
                            f"per {RATE_LIMIT_WINDOW_SECONDS}s. "
                            f"Retry in {retry_after}s."
                        ),
                    }
                ],
                headers={"Retry-After": str(retry_after)},
            )

        timestamps.append(now)

        # Keys that stop being used would otherwise accumulate empty deques.
        if len(_hits) > 10_000:
            for stale in [k for k, v in _hits.items() if not v]:
                del _hits[stale]


def reset() -> None:
    """Clear all counters. For tests."""
    with _lock:
        _hits.clear()
