import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

import numpy as np

sys.path.insert(0, str(Path(__file__).parents[1]))

from forecast_contract import normalize_predictions, validate_request
from runtime import TimesFMRuntime, forecast_fingerprint


def bars(count=32):
    return [{'time': index * 60, 'open': 100 + index, 'high': 101 + index, 'low': 99 + index, 'close': 100.5 + index, 'volume': 10 + index} for index in range(count)]


class FakeForecaster:
    def predict_batch(self, *, contexts, horizon, return_quantiles, use_symmetric_averaging):
        self.context = contexts[0]
        point = np.tile(np.arange(1, horizon + 1, dtype=np.float32), (5, 1)) + 100
        quantiles = np.stack([point - 2, point - 1, point - 0.5, point - 0.2, point, point + 0.2, point + 0.5, point + 1, point + 2], axis=-1)
        yield SimpleNamespace(forecast=point, quantiles=quantiles)


class TimesFMTests(unittest.TestCase):
    def test_request_contract_and_fingerprint(self):
        history = bars()
        clean, timestamps = validate_request(history, [2000 + index * 60 for index in range(10)])
        self.assertEqual(len(clean), 32)
        self.assertNotEqual(forecast_fingerprint('A', 'NSE', '1m', clean, timestamps), forecast_fingerprint('B', 'NSE', '1m', clean, timestamps))

    def test_multivariate_native_quantiles_and_cache(self):
        runtime = TimesFMRuntime()
        fake = FakeForecaster()
        runtime._forecaster = fake
        runtime._state = 'ready'
        timestamps = [2000 + index * 60 for index in range(10)]
        first, first_hit, fingerprint = runtime.forecast(bars(), timestamps, symbol='A', exchange='NSE', interval='1m')
        second, second_hit, second_fingerprint = runtime.forecast(bars(), timestamps, symbol='A', exchange='NSE', interval='1m')
        self.assertFalse(first_hit)
        self.assertTrue(second_hit)
        self.assertEqual(fingerprint, second_fingerprint)
        self.assertEqual(len(first['candles']), 10)
        self.assertEqual(first['uncertainty']['quantile_source'], 'timesfm-native')
        self.assertEqual(first['uncertainty']['horizon'][0]['p10'], 99.0)
        self.assertEqual(first, second)
        self.assertEqual(fake.context.shape, (5, 32))

    def test_candle_constraints_and_optional_volume(self):
        rows = [{'time': index, 'open': 2, 'high': 1, 'low': 3, 'close': 4, 'volume': -2} for index in range(10)]
        candles = normalize_predictions(rows, list(range(10)))
        self.assertTrue(all(candle['high'] >= max(candle['open'], candle['close']) for candle in candles))
        self.assertTrue(all(candle['low'] <= min(candle['open'], candle['close']) for candle in candles))
        self.assertTrue(all(candle['volume'] == 0 for candle in candles))


if __name__ == '__main__':
    unittest.main()
