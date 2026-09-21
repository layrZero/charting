"""Latest-request-wins coordination for local analytics jobs."""
from __future__ import annotations

from threading import RLock


class StaleAnalyticsRequest(RuntimeError):
    pass


class RequestLease:
    def __init__(self, manager, scope, request_id, cancelled):
        self._manager = manager
        self.scope = scope
        self.request_id = request_id
        self.cancelled = cancelled

    def ensure_current(self):
        if self.cancelled.is_set() or not self._manager.is_current(self.scope, self.request_id):
            raise StaleAnalyticsRequest('A newer timeframe request replaced this analysis.')


class RequestManager:
    def __init__(self):
        self._latest = {}
        self._lock = RLock()

    def acquire(self, scope, request_id):
        from threading import Event
        with self._lock:
            previous = self._latest.get(scope)
            if previous is not None and previous[0] != request_id:
                previous[1].set()
            if previous is not None and previous[0] == request_id:
                event = previous[1]
                previous[2] += 1
            else:
                event = Event()
                self._latest[scope] = [request_id, event, 1]
            return RequestLease(self, scope, request_id, event)

    def is_current(self, scope, request_id):
        with self._lock:
            current = self._latest.get(scope)
            return current is not None and current[0] == request_id

    def release(self, lease):
        with self._lock:
            current = self._latest.get(lease.scope)
            if current is not None and current[0] == lease.request_id:
                current[2] -= 1
                if current[2] <= 0:
                    self._latest.pop(lease.scope, None)
