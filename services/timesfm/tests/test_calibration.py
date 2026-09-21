import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from calibration import context_key
from calibration_store import CalibrationStore


class CalibrationStoreTests(unittest.TestCase):
    def test_context_isolated_by_symbol_and_interval(self):
        bars = [{'time': index, 'open': 1, 'high': 2, 'low': 0, 'close': 1.5, 'volume': 1} for index in range(10)]
        self.assertNotEqual(context_key('A', 'NSE', '1m', bars), context_key('B', 'NSE', '1m', bars))
        self.assertNotEqual(context_key('A', 'NSE', '1m', bars), context_key('A', 'NSE', '5m', bars))

    def test_ready_record_round_trips_without_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            store = CalibrationStore(Path(directory) / 'calibration.sqlite3')
            store.begin(run_id='run', context_key='context', symbol='A', exchange='NSE', interval='1m', history_fingerprint='history', model_id='model', model_revision='rev', version=1, origins=32, history_bars=600)
            store.complete('run', {'1': {'P10': 1.0}}, {'1': {'P10': 32}}, [(1, 1, {'P10': 10}, 11)])
            result = store.get_ready('context', ttl_seconds=86400, minimum_new_bars=16, current_bar_count=600)
            self.assertEqual(result['offsets']['1']['P10'], 1.0)
            self.assertNotIn('api_key', str(result))


if __name__ == '__main__':
    unittest.main()
