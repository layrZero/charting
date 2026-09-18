import sys
import unittest
from pathlib import Path
from unittest.mock import Mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from runtime import KronosRuntime, timestamp_series


class RuntimeTests(unittest.TestCase):
    def test_timestamp_series_is_utc_pandas_series(self):
        result = timestamp_series([1700000000, 1700000060])
        self.assertEqual(type(result).__name__, 'Series')
        self.assertEqual(str(result.dt.tz), 'UTC')

    def test_predictor_receives_series_timestamps(self):
        predictor = Mock()
        predictor.predict.return_value.to_dict.return_value = []
        runtime = KronosRuntime.__new__(KronosRuntime)
        runtime._predictor = predictor
        runtime.forecast([
            {'time': 1700000000, 'open': 10, 'high': 12, 'low': 9, 'close': 11, 'volume': 2},
            {'time': 1700000060, 'open': 11, 'high': 13, 'low': 10, 'close': 12, 'volume': 3},
        ], [1700000120] * 1)
        call = predictor.predict.call_args.kwargs
        self.assertEqual(type(call['x_timestamp']).__name__, 'Series')
        self.assertEqual(type(call['y_timestamp']).__name__, 'Series')
        self.assertEqual(str(call['x_timestamp'].dt.tz), 'UTC')
        self.assertEqual(str(call['y_timestamp'].dt.tz), 'UTC')


if __name__ == '__main__':
    unittest.main()
