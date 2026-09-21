import test from 'node:test';
import assert from 'node:assert/strict';
import { completedBars, holidaySet, intervalSeconds, loadForecastCalendar, nextForecastTimes } from '../src/services/forecastCalendar.js';

test('creates ten intraday forecast timestamps and skips a holiday', () => {
  const friday = Date.UTC(2026, 0, 2, 9 - 5, 29 - 30) / 1000;
  const holidays = holidaySet([{ data: [{ date: '2026-01-05' }] }]);
  const result = nextForecastTimes({ lastTime: friday, interval: '1m', holidays });
  assert.equal(result.length, 10);
  assert.ok(result[0] > friday);
  assert.notEqual(new Date((result[0] + 330 * 60) * 1000).toISOString().slice(0, 10), '2026-01-05');
});

test('keeps only completed bars and supports every terminal interval', () => {
  assert.equal(completedBars([{ time: 0 }, { time: 100 }], '1m', 120).length, 1);
  for (const interval of ['1m', '5m', '15m', '1h', '1d', '1w']) assert.ok(intervalSeconds(interval) > 0);
});

test('daily forecast advances through business days', () => {
  const result = nextForecastTimes({ lastTime: Date.UTC(2026, 0, 2) / 1000, interval: '1d' });
  assert.equal(result.length, 10);
  assert.ok(result.every((time, index) => index === 0 || time > result[index - 1]));
});

test('uses IMC-provided session boundaries when available', () => {
  const last = Date.UTC(2026, 0, 2, 3, 59) / 1000;
  const result = nextForecastTimes({ lastTime: last, interval: '1m', session: { openMinutes: 9 * 60, closeMinutes: 9 * 60 + 31 } });
  assert.equal(result[0], last + 60);
  assert.equal(result[1], Date.UTC(2026, 0, 5, 3, 30) / 1000);
});

test('continues with default calendar rules when IMC calendar calls fail', async () => {
  const calendar = await loadForecastCalendar({
    marketTimings: async () => { throw new Error('calendar unavailable'); },
    marketHolidays: async () => { throw new Error('calendar unavailable'); },
  }, 1760000000, 'NSE_INDEX');
  assert.deepEqual(calendar.session, {});
  assert.equal(calendar.holidays.size, 0);
});

test('forwards an abort signal to all calendar requests', async () => {
  const controller = new AbortController();
  const signals = [];
  const client = {
    marketTimings: async (_date, options) => { signals.push(options.signal); return { data: [] }; },
    marketHolidays: async (_year, options) => { signals.push(options.signal); return { data: [] }; },
  };
  await loadForecastCalendar(client, 1760000000, 'NSE_INDEX', { signal: controller.signal });
  assert.equal(signals.length, 3);
  assert.ok(signals.every((signal) => signal === controller.signal));
});
