export const cn = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

export function money(n: number, currency?: string): string {
  const s = Math.round(n).toLocaleString("ru-RU");
  return currency ? `${s} ${currency}` : s;
}

export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return (n / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + " млн";
  if (a >= 10_000) return Math.round(n / 1000).toLocaleString("ru-RU") + " тыс";
  return Math.round(n).toLocaleString("ru-RU");
}

/** «2026-09-21» → «21.09.2026» */
export function dmy(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/** «21–27 сен 2026» */
export function period(startIso: string): string {
  const [y, m, d] = startIso.split("-").map(Number);
  const a = new Date(Date.UTC(y, m - 1, d));
  const b = new Date(Date.UTC(y, m - 1, d + 6));
  const sameMonth = a.getUTCMonth() === b.getUTCMonth();
  return sameMonth
    ? `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]} ${b.getUTCFullYear()}`
    : `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]} – ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
}

export function periodShort(startIso: string): string {
  const [, m, d] = startIso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "только что";
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`;
  return dmy(iso);
}

export function initials(name: string): string {
  const parts = name.replace(/_/g, " ").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
