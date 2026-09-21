"""Historical directional-probability helpers for local TimesFM diagnostics."""
from __future__ import annotations

from math import floor, sqrt

QUANTILE_LEVELS = (('P10', 0.10), ('P25', 0.25), ('P50', 0.50), ('P75', 0.75), ('P90', 0.90))
BUCKET_COUNT = 5
PRIOR_ALPHA = 2.0
PRIOR_BETA = 2.0
WILSON_Z_80 = 1.281551565545


def upward_score(quantiles, origin_close):
    """Approximate P(close > origin_close) from the five native quantiles."""
    points = sorted((float(quantiles[name]), level) for name, level in QUANTILE_LEVELS)
    price = float(origin_close)
    if price <= points[0][0]:
        cdf = 0.05
    elif price >= points[-1][0]:
        cdf = 0.95
    else:
        cdf = 0.50
        for (left_price, left_level), (right_price, right_level) in zip(points, points[1:]):
            if left_price <= price <= right_price:
                if right_price == left_price:
                    cdf = (left_level + right_level) / 2
                else:
                    cdf = left_level + (price - left_price) * (right_level - left_level) / (right_price - left_price)
                break
    return max(0.01, min(0.99, 1.0 - cdf))


def direction_from_close(forecast_close, origin_close):
    if float(forecast_close) > float(origin_close):
        return 'up'
    if float(forecast_close) < float(origin_close):
        return 'down'
    return 'neutral'


def actual_direction(actual_close, origin_close):
    return direction_from_close(actual_close, origin_close)


def bucket_index(score):
    return min(BUCKET_COUNT - 1, max(0, floor(float(score) * BUCKET_COUNT)))


def build_directional_calibration(samples):
    """Build smoothed upward-probability buckets from completed outcomes."""
    buckets = [{'up': 0, 'down': 0} for _ in range(BUCKET_COUNT)]
    neutral_count = 0
    for sample in samples:
        outcome = sample['actual_direction']
        if outcome == 'neutral':
            neutral_count += 1
            continue
        bucket = buckets[bucket_index(sample['raw_upward_score'])]
        bucket[outcome] += 1
    encoded = []
    valid_count = 0
    for bucket in buckets:
        count = bucket['up'] + bucket['down']
        valid_count += count
        probability_up = (bucket['up'] + PRIOR_ALPHA) / (count + PRIOR_ALPHA + PRIOR_BETA)
        encoded.append({'up': bucket['up'], 'down': bucket['down'], 'probability_up': probability_up})
    return {'method': 'five-bucket-beta-binomial-v1', 'sample_count': valid_count, 'neutral_count': neutral_count, 'buckets': encoded}


def _wilson_interval(successes, total):
    if total <= 0:
        return 0.0, 1.0
    probability = successes / total
    denominator = 1 + WILSON_Z_80 ** 2 / total
    centre = (probability + WILSON_Z_80 ** 2 / (2 * total)) / denominator
    spread = WILSON_Z_80 * sqrt((probability * (1 - probability) + WILSON_Z_80 ** 2 / (4 * total)) / total) / denominator
    return max(0.0, centre - spread), min(1.0, centre + spread)


def evaluate_directional_probability(calibration, *, native_quantiles, displayed_close, origin_close):
    """Return the calibrated chance that the displayed TimesFM direction is right."""
    raw_upward_score = upward_score(native_quantiles, origin_close)
    direction = direction_from_close(displayed_close, origin_close)
    if direction == 'neutral' or not calibration or calibration.get('sample_count', 0) < 1:
        return None
    bucket = calibration['buckets'][bucket_index(raw_upward_score)]
    local_count = int(bucket['up']) + int(bucket['down'])
    posterior_up = float(bucket['probability_up'])
    low_up, high_up = _wilson_interval(float(bucket['up']) + PRIOR_ALPHA, local_count + PRIOR_ALPHA + PRIOR_BETA)
    if direction == 'up':
        probability, low, high, raw_direction_score = posterior_up, low_up, high_up, raw_upward_score
    else:
        probability, low, high, raw_direction_score = 1 - posterior_up, 1 - high_up, 1 - low_up, 1 - raw_upward_score
    total = int(calibration['sample_count'])
    evidence = 'higher' if total >= 250 else 'moderate' if total >= 100 else 'low'
    return {
        'direction': direction,
        'calibrated_probability': round(probability, 6),
        'raw_model_score': round(raw_direction_score, 6),
        'interval_low': round(low, 6),
        'interval_high': round(high, 6),
        'uncertainty_interval': {'low': round(low, 6), 'high': round(high, 6)},
        'sample_count': total,
        'local_sample_count': local_count,
        'neutral_count': int(calibration.get('neutral_count', 0)),
        'evidence': evidence,
        'method': calibration.get('method'),
    }
