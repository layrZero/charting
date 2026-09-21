import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from directional_probability import actual_direction, build_directional_calibration, evaluate_directional_probability, upward_score


QUANTILES = {'P10': 90, 'P25': 95, 'P50': 100, 'P75': 105, 'P90': 110}


class DirectionalProbabilityTests(unittest.TestCase):
    def test_quantile_cdf_creates_bounded_upward_score(self):
        self.assertGreater(upward_score(QUANTILES, 96), 0.5)
        self.assertLess(upward_score(QUANTILES, 104), 0.5)
        self.assertGreaterEqual(upward_score(QUANTILES, 1000), 0.01)
        self.assertLessEqual(upward_score(QUANTILES, -1000), 0.99)

    def test_neutral_outcomes_are_excluded(self):
        calibration = build_directional_calibration([
            {'raw_upward_score': 0.7, 'actual_direction': 'up'},
            {'raw_upward_score': 0.7, 'actual_direction': 'neutral'},
            {'raw_upward_score': 0.3, 'actual_direction': 'down'},
        ])
        self.assertEqual(actual_direction(100, 100), 'neutral')
        self.assertEqual(calibration['sample_count'], 2)
        self.assertEqual(calibration['neutral_count'], 1)

    def test_probability_describes_displayed_direction_and_is_bounded(self):
        calibration = build_directional_calibration([
            {'raw_upward_score': 0.75, 'actual_direction': 'up'} for _ in range(24)
        ] + [
            {'raw_upward_score': 0.75, 'actual_direction': 'down'} for _ in range(8)
        ])
        result = evaluate_directional_probability(calibration, native_quantiles=QUANTILES, displayed_close=104, origin_close=99)
        self.assertEqual(result['direction'], 'up')
        self.assertEqual(result['sample_count'], 32)
        self.assertEqual(result['evidence'], 'low')
        self.assertGreaterEqual(result['calibrated_probability'], 0)
        self.assertLessEqual(result['calibrated_probability'], 1)
        self.assertLessEqual(result['interval_low'], result['interval_high'])
        self.assertEqual(result['uncertainty_interval']['low'], result['interval_low'])
        self.assertEqual(result['uncertainty_interval']['high'], result['interval_high'])


if __name__ == '__main__':
    unittest.main()
