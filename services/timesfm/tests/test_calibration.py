import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from calibration import context_key, stable_context_key
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

    def test_stable_scope_reuses_ready_record_for_small_history_refresh(self):
        with tempfile.TemporaryDirectory() as directory:
            store = CalibrationStore(Path(directory) / 'calibration.sqlite3')
            scope = stable_context_key('A', 'NSE', '1m', 'model', 'rev')
            store.begin(run_id='run', context_key='exact-old', stable_context_key=scope, symbol='A', exchange='NSE', interval='1m', history_fingerprint='exact-old', model_id='model', model_revision='rev', version=1, directional_version=1, origins=32, history_bars=600)
            directional = {'1': {'sample_count': 32, 'neutral_count': 0, 'method': 'test', 'buckets': [{'up': 2, 'down': 1, 'probability_up': 0.6}] * 5}}
            store.complete('run', {'1': {'P10': 1.0}}, {'1': {'P10': 32}}, [(1, 1, {'P10': 10}, 11, 10, 0.6, 'up')], directional)
            reused = store.get_reusable(stable_context_key=scope, symbol='A', exchange='NSE', interval='1m', model_id='model', model_revision='rev', version=1, directional_version=1, ttl_seconds=86400, minimum_new_bars=16, current_bar_count=615)
            self.assertEqual(reused['run_id'], 'run')
            self.assertEqual(reused['directional']['1']['sample_count'], 32)
            self.assertIsNone(store.get_reusable(stable_context_key=scope, symbol='A', exchange='NSE', interval='1m', model_id='model', model_revision='rev', version=1, directional_version=1, ttl_seconds=86400, minimum_new_bars=16, current_bar_count=616))

    def test_quantile_only_record_is_not_reused_as_directional_calibration(self):
        with tempfile.TemporaryDirectory() as directory:
            store = CalibrationStore(Path(directory) / 'calibration.sqlite3')
            scope = stable_context_key('A', 'NSE', '1m', 'model', 'rev')
            store.begin(run_id='legacy', context_key='legacy-history', stable_context_key=scope, symbol='A', exchange='NSE', interval='1m', history_fingerprint='legacy-history', model_id='model', model_revision='rev', version=1, origins=32, history_bars=600)
            store.complete('legacy', {'1': {'P10': 1.0}}, {'1': {'P10': 32}}, [(1, 1, {'P10': 10}, 11)])
            self.assertIsNone(store.get_reusable(stable_context_key=scope, symbol='A', exchange='NSE', interval='1m', model_id='model', model_revision='rev', version=1, directional_version=1, ttl_seconds=86400, minimum_new_bars=16, current_bar_count=600))

    def test_status_can_be_read_by_run_id(self):
        with tempfile.TemporaryDirectory() as directory:
            store = CalibrationStore(Path(directory) / 'calibration.sqlite3')
            store.begin(run_id='run', context_key='exact', stable_context_key='stable', symbol='A', exchange='NSE', interval='1m', history_fingerprint='exact', model_id='model', model_revision='rev', version=1, origins=32, history_bars=106)
            status = store.status_by_run_id('run')
            self.assertEqual(status['stable_context_key'], 'stable')
            self.assertEqual(status['history_bars'], 106)
            self.assertEqual(status['status'], 'running')


if __name__ == '__main__':
    unittest.main()
