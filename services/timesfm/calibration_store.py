"""SQLite persistence for local TimesFM quantile calibration."""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sqlite3
from threading import RLock
from contextlib import closing


class CalibrationStore:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        with closing(self._connect()) as connection:
            connection.execute('BEGIN')
            connection.executescript('''
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS calibration_runs (
                    run_id TEXT PRIMARY KEY,
                    context_key TEXT NOT NULL UNIQUE,
                    stable_context_key TEXT,
                    symbol TEXT NOT NULL,
                    exchange TEXT NOT NULL,
                    interval TEXT NOT NULL,
                    history_fingerprint TEXT NOT NULL,
                    model_id TEXT NOT NULL,
                    model_revision TEXT NOT NULL,
                    calibration_version INTEGER NOT NULL,
                    directional_calibration_version INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL,
                    origins INTEGER NOT NULL,
                    history_bars INTEGER NOT NULL DEFAULT 0,
                    started_at TEXT NOT NULL,
                    completed_at TEXT,
                    error TEXT
                );
                CREATE TABLE IF NOT EXISTS calibration_origins (
                    run_id TEXT NOT NULL,
                    origin_time INTEGER NOT NULL,
                    horizon INTEGER NOT NULL,
                    native_quantiles TEXT NOT NULL,
                    actual_close REAL NOT NULL,
                    origin_close REAL,
                    raw_upward_score REAL,
                    actual_direction TEXT,
                    PRIMARY KEY (run_id, origin_time, horizon),
                    FOREIGN KEY (run_id) REFERENCES calibration_runs(run_id)
                );
                CREATE TABLE IF NOT EXISTS calibration_results (
                    run_id TEXT NOT NULL,
                    horizon INTEGER NOT NULL,
                    offsets TEXT NOT NULL,
                    sample_count INTEGER NOT NULL,
                    coverage TEXT NOT NULL,
                    PRIMARY KEY (run_id, horizon),
                    FOREIGN KEY (run_id) REFERENCES calibration_runs(run_id)
                );
                CREATE TABLE IF NOT EXISTS calibration_directional_results (
                    run_id TEXT NOT NULL,
                    horizon INTEGER NOT NULL,
                    result TEXT NOT NULL,
                    PRIMARY KEY (run_id, horizon),
                    FOREIGN KEY (run_id) REFERENCES calibration_runs(run_id)
                );
            ''')
            columns = {row[1] for row in connection.execute('PRAGMA table_info(calibration_runs)')}
            if 'history_bars' not in columns:
                connection.execute('ALTER TABLE calibration_runs ADD COLUMN history_bars INTEGER NOT NULL DEFAULT 0')
            if 'stable_context_key' not in columns:
                connection.execute('ALTER TABLE calibration_runs ADD COLUMN stable_context_key TEXT')
            if 'directional_calibration_version' not in columns:
                connection.execute('ALTER TABLE calibration_runs ADD COLUMN directional_calibration_version INTEGER NOT NULL DEFAULT 0')
            origin_columns = {row[1] for row in connection.execute('PRAGMA table_info(calibration_origins)')}
            if 'origin_close' not in origin_columns:
                connection.execute('ALTER TABLE calibration_origins ADD COLUMN origin_close REAL')
            if 'raw_upward_score' not in origin_columns:
                connection.execute('ALTER TABLE calibration_origins ADD COLUMN raw_upward_score REAL')
            if 'actual_direction' not in origin_columns:
                connection.execute('ALTER TABLE calibration_origins ADD COLUMN actual_direction TEXT')
            connection.execute('CREATE INDEX IF NOT EXISTS idx_calibration_scope ON calibration_runs (stable_context_key, symbol, exchange, interval, model_id, model_revision, calibration_version, status)')
            connection.commit()

    def _connect(self):
        connection = sqlite3.connect(self.path, timeout=10)
        connection.execute('PRAGMA busy_timeout=10000')
        return connection

    @staticmethod
    def _now():
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _legacy_scope(row):
        if row[2]:
            return row[2]
        payload = {'symbol': row[3], 'exchange': row[4], 'interval': row[5], 'model': row[6], 'revision': row[7], 'version': row[8]}
        return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

    def get_ready(self, context_key, *, ttl_seconds, minimum_new_bars, current_bar_count):
        with self._lock, closing(self._connect()) as connection:
            row = connection.execute('SELECT run_id, completed_at, history_bars FROM calibration_runs WHERE context_key=? AND status=?', (context_key, 'ready')).fetchone()
            if not row:
                return None
            try:
                age = (datetime.now(timezone.utc) - datetime.fromisoformat(row[1])).total_seconds()
            except (TypeError, ValueError):
                return None
            if age > ttl_seconds or current_bar_count - int(row[2]) >= minimum_new_bars:
                return None
            results = connection.execute('SELECT horizon, offsets FROM calibration_results WHERE run_id=? ORDER BY horizon', (row[0],)).fetchall()
            return {'run_id': row[0], 'offsets': {str(horizon): json.loads(offsets) for horizon, offsets in results}, 'calibration_status': 'ready', 'completed_at': row[1], 'history_bars': int(row[2])}

    def get_reusable(self, *, stable_context_key, symbol, exchange, interval, model_id, model_revision, version, directional_version, ttl_seconds, minimum_new_bars, current_bar_count):
        """Return the newest usable ready result for a stable chart scope.

        Older databases did not have stable_context_key; the identifying columns
        are intentionally included in the query so those records remain reusable.
        """
        with self._lock, closing(self._connect()) as connection:
            row = connection.execute('''SELECT run_id, completed_at, history_bars, stable_context_key
                FROM calibration_runs
                WHERE status=? AND symbol=? AND exchange=? AND interval=? AND model_id=? AND model_revision=? AND calibration_version=? AND directional_calibration_version=?
                  AND (stable_context_key=? OR stable_context_key IS NULL)
                  AND EXISTS (SELECT 1 FROM calibration_directional_results WHERE calibration_directional_results.run_id=calibration_runs.run_id)
                ORDER BY completed_at DESC LIMIT 1''', ('ready', symbol, exchange, interval, model_id, model_revision, version, directional_version, stable_context_key)).fetchone()
            if not row:
                return None
            try:
                age = (datetime.now(timezone.utc) - datetime.fromisoformat(row[1])).total_seconds()
            except (TypeError, ValueError):
                return None
            if age > ttl_seconds or current_bar_count - int(row[2]) >= minimum_new_bars:
                return None
            results = connection.execute('SELECT horizon, offsets FROM calibration_results WHERE run_id=? ORDER BY horizon', (row[0],)).fetchall()
            directional = connection.execute('SELECT horizon, result FROM calibration_directional_results WHERE run_id=? ORDER BY horizon', (row[0],)).fetchall()
            return {'run_id': row[0], 'stable_context_key': row[3] or stable_context_key, 'offsets': {str(horizon): json.loads(offsets) for horizon, offsets in results}, 'directional': {str(horizon): json.loads(result) for horizon, result in directional}, 'calibration_status': 'ready', 'completed_at': row[1], 'history_bars': int(row[2])}

    def begin(self, *, run_id, context_key, stable_context_key=None, symbol, exchange, interval, history_fingerprint, model_id, model_revision, version, origins, history_bars, directional_version=0):
        with self._lock, closing(self._connect()) as connection:
            connection.execute('''INSERT OR REPLACE INTO calibration_runs
                (run_id, context_key, stable_context_key, symbol, exchange, interval, history_fingerprint, model_id, model_revision, calibration_version, directional_calibration_version, status, origins, history_bars, started_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', ?, ?, ?)''', (run_id, context_key, stable_context_key, symbol, exchange, interval, history_fingerprint, model_id, model_revision, version, directional_version, origins, history_bars, self._now()))
            connection.commit()

    def complete(self, run_id, offsets_by_horizon, coverage_by_horizon, origin_rows, directional_by_horizon=None):
        with self._lock, closing(self._connect()) as connection:
            connection.execute('BEGIN')
            for row in origin_rows:
                origin_time, horizon, quantiles, actual_close, *directional_fields = row
                origin_close, raw_upward_score, actual_direction = (directional_fields + [None, None, None])[:3]
                connection.execute('''INSERT OR REPLACE INTO calibration_origins
                    (run_id, origin_time, horizon, native_quantiles, actual_close, origin_close, raw_upward_score, actual_direction)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)''', (run_id, origin_time, horizon, json.dumps(quantiles), actual_close, origin_close, raw_upward_score, actual_direction))
            for horizon, offsets in offsets_by_horizon.items():
                coverage = coverage_by_horizon.get(horizon, {})
                connection.execute('INSERT OR REPLACE INTO calibration_results VALUES (?, ?, ?, ?, ?)', (run_id, horizon, json.dumps(offsets), sum(coverage.values()) if coverage else 0, json.dumps(coverage)))
            for horizon, result in (directional_by_horizon or {}).items():
                connection.execute('INSERT OR REPLACE INTO calibration_directional_results VALUES (?, ?, ?)', (run_id, horizon, json.dumps(result)))
            connection.execute('UPDATE calibration_runs SET status=?, completed_at=?, error=NULL WHERE run_id=?', ('ready', self._now(), run_id))
            connection.commit()

    def fail(self, run_id, message):
        with self._lock, closing(self._connect()) as connection:
            connection.execute('UPDATE calibration_runs SET status=?, completed_at=?, error=? WHERE run_id=?', ('failed', self._now(), str(message)[:500], run_id))
            connection.commit()

    def status(self, context_key):
        with self._lock, self._connect() as connection:
            row = connection.execute('SELECT run_id, status, stable_context_key, symbol, exchange, interval, model_id, model_revision, calibration_version, history_bars, origins, started_at, completed_at, error FROM calibration_runs WHERE context_key=? OR stable_context_key=? ORDER BY started_at DESC LIMIT 1', (context_key, context_key)).fetchone()
            if not row:
                return None
            return {'run_id': row[0], 'status': row[1], 'stable_context_key': self._legacy_scope(row), 'symbol': row[3], 'exchange': row[4], 'interval': row[5], 'history_bars': row[9], 'total_origins': row[10], 'started_at': row[11], 'completed_at': row[12], 'error': row[13]}

    def status_by_run_id(self, run_id):
        with self._lock, closing(self._connect()) as connection:
            row = connection.execute('SELECT run_id, status, stable_context_key, symbol, exchange, interval, model_id, model_revision, calibration_version, history_bars, origins, started_at, completed_at, error FROM calibration_runs WHERE run_id=?', (run_id,)).fetchone()
            if not row:
                return None
            return {'run_id': row[0], 'status': row[1], 'stable_context_key': self._legacy_scope(row), 'symbol': row[3], 'exchange': row[4], 'interval': row[5], 'history_bars': row[9], 'total_origins': row[10], 'started_at': row[11], 'completed_at': row[12], 'error': row[13]}

    def invalidate(self, context_key):
        with self._lock, closing(self._connect()) as connection:
            connection.execute('DELETE FROM calibration_runs WHERE context_key=?', (context_key,))
            connection.commit()

    def invalidate_scope(self, stable_context_key, *, symbol=None, exchange=None, interval=None, model_id=None, model_revision=None, version=None):
        with self._lock, closing(self._connect()) as connection:
            if symbol is None:
                connection.execute('DELETE FROM calibration_runs WHERE stable_context_key=?', (stable_context_key,))
            else:
                connection.execute('''DELETE FROM calibration_runs
                    WHERE symbol=? AND exchange=? AND interval=? AND model_id=? AND model_revision=? AND calibration_version=?''',
                    (symbol, exchange, interval, model_id, model_revision, version))
            connection.commit()
