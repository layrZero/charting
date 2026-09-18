const IST_OFFSET_MS = 330 * 60 * 1000;
const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const SESSION_OPEN_MINUTES = 9 * 60 + 15;
const SESSION_CLOSE_MINUTES = 15 * 60 + 30;

export const intervalSeconds = (interval) => {
  const match = /^(\d+)(m|h|d|w)$/i.exec(String(interval || '').trim());
  if (!match) throw new Error(`Unsupported forecast interval: ${interval}`);
  const count = Number(match[1]);
  return count * ({ m: MINUTE, h: HOUR, d: DAY, w: 7 * DAY }[match[2].toLowerCase()]);
};

const istDate = (seconds) => new Date(seconds * 1000 + IST_OFFSET_MS);
const isoDate = (date) => date.toISOString().slice(0, 10);
const secondsAtIst = (date, minutes) => Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, minutes) - IST_OFFSET_MS) / 1000);
const nextDate = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));

const holidayDate = (entry) => {
  if (typeof entry === 'string') return entry.slice(0, 10);
  if (!entry || typeof entry !== 'object') return null;
  return String(entry.date || entry.holiday_date || entry.trading_date || '').slice(0, 10) || null;
};

export const holidaySet = (payloads) => new Set(payloads.flatMap((payload) => (payload?.data || payload || []).map(holidayDate).filter(Boolean)));

const isTradingDay = (date, holidays) => ![0, 6].includes(date.getUTCDay()) && !holidays.has(isoDate(date));
const nextTradingDate = (date, holidays) => {
  let candidate = nextDate(date);
  while (!isTradingDay(candidate, holidays)) candidate = nextDate(candidate);
  return candidate;
};

export const nextForecastTimes = ({ lastTime, interval, count = 10, holidays = new Set(), session = {} }) => {
  const seconds = intervalSeconds(interval);
  const unit = String(interval).slice(-1).toLowerCase();
  const openMinutes = Number.isFinite(session.openMinutes) ? session.openMinutes : SESSION_OPEN_MINUTES;
  const closeMinutes = Number.isFinite(session.closeMinutes) ? session.closeMinutes : SESSION_CLOSE_MINUTES;
  const output = [];
  let cursor = Number(lastTime);
  if (!Number.isFinite(cursor)) throw new Error('A last completed candle timestamp is required.');

  if (unit === 'm' || unit === 'h') {
    while (output.length < count) {
      const date = istDate(cursor);
      const next = cursor + seconds;
      const nextDateIst = istDate(next);
      const minuteOfDay = nextDateIst.getUTCHours() * 60 + nextDateIst.getUTCMinutes();
      if (isoDate(nextDateIst) === isoDate(date) && isTradingDay(date, holidays) && minuteOfDay >= openMinutes && minuteOfDay < closeMinutes) {
        cursor = next;
      } else {
        const tradeDate = nextTradingDate(date, holidays);
        cursor = secondsAtIst(tradeDate, openMinutes);
      }
      output.push(cursor);
    }
    return output;
  }

  let date = istDate(cursor);
  const minuteOfDay = date.getUTCHours() * 60 + date.getUTCMinutes();
  while (output.length < count) {
    if (unit === 'w') {
      do { date = nextTradingDate(date, holidays); } while (date.getUTCDay() !== 1 && output.length === 0);
      if (output.length > 0) {
        do { date = nextTradingDate(date, holidays); } while (date.getUTCDay() !== 1);
      }
    } else {
      date = nextTradingDate(date, holidays);
    }
    output.push(secondsAtIst(date, minuteOfDay));
  }
  return output;
};

export const completedBars = (bars, interval, now = Math.floor(Date.now() / 1000)) => {
  const seconds = intervalSeconds(interval);
  return bars.filter((bar) => Number.isFinite(bar.time) && bar.time + seconds <= now);
};

const calendarExchange = (exchange) => ({ NSE_INDEX: 'NSE', BSE_INDEX: 'BSE', NFO: 'NSE', BFO: 'BSE' }[exchange] || exchange);

export const loadForecastCalendar = async (client, lastTime, exchange) => {
  const year = istDate(lastTime).getUTCFullYear();
  const date = isoDate(istDate(lastTime));
  const results = await Promise.allSettled([
    client.marketTimings(date),
    client.marketHolidays(year),
    client.marketHolidays(year + 1),
  ]);
  const [timingsResult, holidaysResult, nextHolidaysResult] = results;
  const currentTimings = timingsResult.status === 'fulfilled' ? timingsResult.value : null;
  const holidays = [
    holidaysResult.status === 'fulfilled' ? holidaysResult.value : [],
    nextHolidaysResult.status === 'fulfilled' ? nextHolidaysResult.value : [],
  ];
  const timing = (Array.isArray(currentTimings?.data) ? currentTimings.data : []).find((item) => item.exchange === calendarExchange(exchange));
  if (!timing) return { holidays: holidaySet(holidays), session: {} };
  const start = istDate(Number(timing.start_time) / 1000); const end = istDate(Number(timing.end_time) / 1000);
  return { holidays: holidaySet(holidays), session: { openMinutes: start.getUTCHours() * 60 + start.getUTCMinutes(), closeMinutes: end.getUTCHours() * 60 + end.getUTCMinutes() } };
};
