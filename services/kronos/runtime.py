"""Lazy adapter around the pinned, local-only Kronos checkout."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
DEFAULT_SOURCE = ROOT / '.deps' / 'Kronos'


class KronosRuntime:
    def __init__(self):
        source = Path(os.environ.get('KRONOS_SOURCE_DIR', DEFAULT_SOURCE))
        if not (source / 'model').is_dir():
            raise RuntimeError('Kronos is not bootstrapped. Run npm run forecast:bootstrap first.')
        sys.path.insert(0, str(source))
        from model import Kronos, KronosPredictor, KronosTokenizer
        self._predictor = KronosPredictor(
            Kronos.from_pretrained(os.environ.get('KRONOS_MODEL', 'NeoQuasar/Kronos-small')),
            KronosTokenizer.from_pretrained(os.environ.get('KRONOS_TOKENIZER', 'NeoQuasar/Kronos-Tokenizer-base')),
            max_context=512,
            device=os.environ.get('KRONOS_DEVICE', 'cpu'),
        )

    def forecast(self, bars, timestamps):
        frame = pd.DataFrame(bars)
        x_timestamp = pd.to_datetime(frame.pop('time'), unit='s', utc=True)
        prediction = self._predictor.predict(
            df=frame[['open', 'high', 'low', 'close', 'volume']],
            x_timestamp=x_timestamp,
            y_timestamp=pd.to_datetime(timestamps, unit='s', utc=True),
            pred_len=10, T=1.0, top_p=0.9, sample_count=1,
        )
        return prediction.to_dict(orient='records')
