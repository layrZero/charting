import sys
import unittest
from pathlib import Path
from unittest.mock import Mock

import numpy as np
import pandas as pd
import torch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from runtime import KronosRuntime, forecast_fingerprint, timestamp_series


class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.runtime = KronosRuntime.__new__(KronosRuntime)
        self.runtime._cache = __import__('collections').OrderedDict()
        self.runtime._cache_lock = __import__('threading').RLock()
        self.predictor = Mock()
        self.predictor.predict.side_effect = lambda **kwargs: pd.DataFrame([
            {'open': float(torch.rand(1)), 'high': 2, 'low': 0.5, 'close': 1.5, 'volume': 3}
            for _ in range(10)
        ])
        self.runtime._predictor = self.predictor

    def test_timestamp_series_is_utc_pandas_series(self):
        result = timestamp_series([1700000000, 1700000060])
        self.assertEqual(type(result).__name__, 'Series')
        self.assertEqual(str(result.dt.tz), 'UTC')

    def test_predictor_receives_series_timestamps(self):
        predictor = Mock()
        predictor.predict.return_value.to_dict.return_value = []
        self.runtime._predictor = predictor
        self.runtime.forecast([
            {'time': 1700000000, 'open': 10, 'high': 12, 'low': 9, 'close': 11, 'volume': 2},
            {'time': 1700000060, 'open': 11, 'high': 13, 'low': 10, 'close': 12, 'volume': 3},
        ], [1700000120], symbol='TEST', exchange='NSE', interval='1m')
        call = predictor.predict.call_args.kwargs
        self.assertEqual(type(call['x_timestamp']).__name__, 'Series')
        self.assertEqual(type(call['y_timestamp']).__name__, 'Series')
        self.assertEqual(str(call['x_timestamp'].dt.tz), 'UTC')
        self.assertEqual(str(call['y_timestamp'].dt.tz), 'UTC')

    def test_fingerprint_changes_with_request_dimensions(self):
        bars = [{'time': 100, 'open': 10, 'high': 11, 'low': 9, 'close': 10.5, 'volume': 2}]
        base = forecast_fingerprint('NIFTY', 'NSE_INDEX', '5m', bars, [400, 700])
        self.assertNotEqual(base, forecast_fingerprint('BANKNIFTY', 'NSE_INDEX', '5m', bars, [400, 700]))
        self.assertNotEqual(base, forecast_fingerprint('NIFTY', 'NSE_INDEX', '15m', bars, [400, 700]))
        self.assertNotEqual(base, forecast_fingerprint('NIFTY', 'NSE_INDEX', '5m', bars, [700, 1000]))

    def test_identical_requests_are_seeded_and_cached(self):
        bars = [
            {'time': 1700000000, 'open': 10, 'high': 12, 'low': 9, 'close': 11, 'volume': 2},
            {'time': 1700000060, 'open': 11, 'high': 13, 'low': 10, 'close': 12, 'volume': 3},
        ]
        first, first_cache, first_fingerprint = self.runtime.forecast(bars, [1700000120], symbol='TEST', exchange='NSE', interval='1m')
        second, second_cache, second_fingerprint = self.runtime.forecast(bars, [1700000120], symbol='TEST', exchange='NSE', interval='1m')
        self.assertFalse(first_cache)
        self.assertTrue(second_cache)
        self.assertEqual(first_fingerprint, second_fingerprint)
        self.assertEqual(first, second)
        self.assertEqual(self.predictor.predict.call_count, 1)

    def test_rng_state_is_restored_after_inference(self):
        bars = [{'time': 1700000000, 'open': 10, 'high': 12, 'low': 9, 'close': 11, 'volume': 2}]
        random_state = __import__('random').getstate()
        numpy_state = np.random.get_state()
        torch_state = torch.random.get_rng_state()
        self.runtime.forecast(bars, [1700000060], symbol='TEST', exchange='NSE', interval='1m')
        self.assertEqual(random_state, __import__('random').getstate())
        self.assertTrue(np.array_equal(numpy_state[1], np.random.get_state()[1]))
        self.assertTrue(torch.equal(torch_state, torch.random.get_rng_state()))


if __name__ == '__main__':
    unittest.main()
