"""Validation and JSON-safe forecast helpers kept independent of the model runtime."""
from __future__ import annotations

from math import isfinite

REQUIRED = ("time", "open", "high", "low", "close")


def validate_request(bars, future_timestamps):
    if not isinstance(bars, list) or not 1 <= len(bars) <= 512:
        raise ValueError("bars must contain between 1 and 512 completed candles")
    if not isinstance(future_timestamps, list) or len(future_timestamps) != 10:
        raise ValueError("future_timestamps must contain exactly 10 timestamps")
    clean_bars = []
    previous = -1
    for item in bars:
        if not isinstance(item, dict) or any(key not in item for key in REQUIRED):
            raise ValueError("each candle needs time, open, high, low, and close")
        candle = {key: float(item[key]) for key in REQUIRED}
        candle["time"] = int(candle["time"])
        candle["volume"] = float(item.get("volume") or 0)
        if not all(isfinite(value) for value in candle.values()) or candle["time"] <= previous:
            raise ValueError("candles must be finite and strictly timestamp ordered")
        if candle["high"] < max(candle["open"], candle["close"]) or candle["low"] > min(candle["open"], candle["close"]):
            raise ValueError("each candle must have low <= open/close <= high")
        clean_bars.append(candle)
        previous = candle["time"]
    timestamps = [int(value) for value in future_timestamps]
    if any(right <= left for left, right in zip(timestamps, timestamps[1:])) or timestamps[0] <= clean_bars[-1]["time"]:
        raise ValueError("future timestamps must be strictly ordered after history")
    return clean_bars, timestamps


def normalize_predictions(rows, timestamps):
    candles = []
    for timestamp, row in zip(timestamps, rows, strict=True):
        candle = {"time": timestamp, "open": float(row["open"]), "high": float(row["high"]), "low": float(row["low"]), "close": float(row["close"]), "volume": float(row.get("volume", 0) or 0)}
        if not all(isfinite(value) for value in candle.values()):
            raise ValueError("Kronos returned non-finite values")
        candles.append(candle)
    if len(candles) != 10:
        raise ValueError("Kronos must return exactly ten candles")
    return candles
