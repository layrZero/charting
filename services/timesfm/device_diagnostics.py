"""Print a non-secret TimesFM device diagnostic for startup scripts."""
from __future__ import annotations

import json

from device import resolve_device


if __name__ == "__main__":
    info = resolve_device()
    print(json.dumps(info.as_dict(), sort_keys=True))
    print(f"TimesFM device: {info.selected.upper()}")
    if info.fallback_reason:
        print(f"TimesFM device warning: {info.fallback_reason}")
