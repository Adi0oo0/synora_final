const pad = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' in the person's own time zone. Accepts a Date or an ISO string. */
export function localDate(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses 'YYYY-MM-DD' as local midnight (new Date('2026-01-05') would be UTC). */
export function parseDay(day) {
  const [y, m, d] = String(day).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export const isToday = (iso) => localDate(iso) === localDate();

export function addDays(day, n) {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return localDate(d);
}

/** Whole days from `from` to `to` (both 'YYYY-MM-DD'). Negative when `to` is earlier. */
export function daysBetween(from, to) {
  const a = parseDay(from);
  const b = parseDay(to);
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
}

export const timeLabel = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const dateLabel = (iso) =>
  new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });

export const dateTimeLabel = (iso) => `${dateLabel(iso)}, ${timeLabel(iso)}`;

/** Value for <input type="datetime-local">, in local time. */
export function toInputDateTime(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  return `${localDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const fromInputDateTime = (text) => new Date(text).toISOString();
