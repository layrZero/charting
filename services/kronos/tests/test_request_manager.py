import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from request_manager import RequestManager, StaleAnalyticsRequest


class RequestManagerTests(unittest.TestCase):
    def test_new_request_stales_previous_request_in_same_chart_scope(self):
        manager = RequestManager()
        first = manager.acquire('NIFTY:NSE_INDEX', '1m-request')
        second = manager.acquire('NIFTY:NSE_INDEX', '5m-request')
        with self.assertRaises(StaleAnalyticsRequest):
            first.ensure_current()
        second.ensure_current()

    def test_same_request_can_be_shared_by_duplicate_forecast_calls(self):
        manager = RequestManager()
        first = manager.acquire('NIFTY:NSE_INDEX', 'same-request')
        second = manager.acquire('NIFTY:NSE_INDEX', 'same-request')
        first.ensure_current()
        second.ensure_current()
        manager.release(first)
        second.ensure_current()
        manager.release(second)
        self.assertFalse(manager.is_current('NIFTY:NSE_INDEX', 'same-request'))


if __name__ == '__main__':
    unittest.main()
