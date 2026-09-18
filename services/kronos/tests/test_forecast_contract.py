import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from forecast_contract import normalize_predictions, validate_request


def bars():
    return [
        {'time': 100, 'open': 10, 'high': 12, 'low': 9, 'close': 11, 'volume': 4},
        {'time': 160, 'open': 11, 'high': 13, 'low': 10, 'close': 12},
    ]


class ForecastContractTests(unittest.TestCase):
    def test_accepts_ohlcv_and_exactly_ten_future_times(self):
        clean, times = validate_request(bars(), list(range(220, 820, 60)))
        self.assertEqual(clean[1]['volume'], 0)
        self.assertEqual(len(times), 10)

    def test_rejects_malformed_or_unordered_candles(self):
        bad = bars(); bad[1]['time'] = 100
        with self.assertRaises(ValueError): validate_request(bad, list(range(220, 820, 60)))
        with self.assertRaises(ValueError): validate_request(bars(), [220] * 10)

    def test_normalizes_ten_predictions(self):
        rows = [{'open': 1, 'high': 2, 'low': 0.5, 'close': 1.5, 'volume': 3} for _ in range(10)]
        candles = normalize_predictions(rows, list(range(220, 820, 60)))
        self.assertEqual(candles[0]['time'], 220)
        self.assertEqual(len(candles), 10)


if __name__ == '__main__':
    unittest.main()
