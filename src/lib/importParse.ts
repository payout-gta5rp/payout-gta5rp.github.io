/**
 * Разбор таблицы сотрудников, вставленной из WPS / Excel / Google Таблиц (TSV) или CSV.
 * Колонки определяются по заголовку; без заголовка порядок: Имя, Паспорт, Отдел, Должность.
 */

export type Field = "name" | "passport" | "dept" | "position" | "skip";

export interface ParsedRow {
  line: number;
  name: string;
  passport: string;
  dept: string;
  position: string;
}

export interface ParseResult {
  columns: Field[];
  hasHeader: boolean;
  rows: ParsedRow[];
}

const HEADER: [Field, RegExp][] = [
  ["passport", /паспорт|passport|№\s*п|static|id/i],
  ["dept", /отдел|подразд|department|dept|блок/i],
  ["position", /должност|ранг|звани|rank|position|role/i],
  ["name", /имя|сотрудник|фио|ник|name|nick/i],
];

export function splitRows(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
  if (!lines.length) return [];
  const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  return lines.map((l) => splitLine(l, sep).map((c) => c.trim()));
}

function splitLine(line: string, sep: string): string[] {
  if (sep === "\t") return line.split("\t");
  // CSV с кавычками
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') (cur += '"'), i++;
      else q = !q;
    } else if (ch === sep && !q) out.push(cur), (cur = "");
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export function detectColumns(header: string[]): Field[] | null {
  const cols = header.map((h) => HEADER.find(([, re]) => re.test(h))?.[0] ?? "skip");
  return cols.includes("name") ? dedupe(cols) : null;
}

function dedupe(cols: Field[]): Field[] {
  const seen = new Set<Field>();
  return cols.map((c) => (c !== "skip" && seen.has(c) ? "skip" : (seen.add(c), c)));
}

export function parseEmployees(text: string, override?: Field[]): ParseResult {
  const table = splitRows(text);
  if (!table.length) return { columns: [], hasHeader: false, rows: [] };
  const detected = detectColumns(table[0]);
  const hasHeader = !!detected;
  const width = Math.max(...table.map((r) => r.length));
  const columns: Field[] =
    override ?? detected ?? guessByContent(table, width);
  const body = hasHeader ? table.slice(1) : table;
  const rows: ParsedRow[] = [];
  body.forEach((cells, i) => {
    const get = (f: Field) => {
      const idx = columns.indexOf(f);
      return idx >= 0 ? (cells[idx] ?? "").trim() : "";
    };
    const r = {
      line: i + 1 + (hasHeader ? 1 : 0),
      name: get("name").replace(/\s+/g, " "),
      passport: get("passport").replace(/\D/g, ""),
      dept: get("dept"),
      position: get("position"),
    };
    if (r.name || r.passport) rows.push(r);
  });
  return { columns, hasHeader, rows };
}

/** Без заголовка: колонка из одних цифр — паспорт, первая текстовая — имя, дальше отдел и должность. */
function guessByContent(table: string[][], width: number): Field[] {
  const cols: Field[] = Array(width).fill("skip");
  const isNum = (c: number) => table.every((r) => !r[c] || /^\d[\d\s]*$/.test(r[c]));
  const numeric = [...Array(width).keys()].filter(isNum);
  const text = [...Array(width).keys()].filter((c) => !numeric.includes(c));
  // Чаще всего номер строки — короткие числа, паспорт — длиннее
  const passport = numeric.sort((a, b) => avgLen(table, b) - avgLen(table, a))[0];
  if (passport != null && avgLen(table, passport) >= 3) cols[passport] = "passport";
  const order: Field[] = ["name", "dept", "position"];
  // Короткие тексты (≤5 символов) скорее отдел, длинные — имя/должность
  const textCols = [...text];
  const deptIdx = textCols.find((c) => avgLen(table, c) <= 6 && textCols.indexOf(c) > 0);
  if (deptIdx != null) {
    cols[deptIdx] = "dept";
    textCols.splice(textCols.indexOf(deptIdx), 1);
    order.splice(1, 1);
  }
  textCols.forEach((c, i) => order[i] && (cols[c] = order[i]));
  return cols;
}

function avgLen(table: string[][], c: number): number {
  const vals = table.map((r) => (r[c] ?? "").trim()).filter(Boolean);
  return vals.length ? vals.reduce((s, v) => s + v.length, 0) / vals.length : 0;
}

/** Нестрогий поиск по названию: регистр, пробелы, «ё», латиница/кириллица в похожих буквах. */
export function norm(s: string): string {
  const map: Record<string, string> = { а: "a", в: "b", е: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x" };
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[\s_.\-]+/g, " ")
    .trim()
    .replace(/[авекмнорстух]/g, (ch) => map[ch] ?? ch);
}

export function findByName<T extends { name: string }>(list: T[], name: string): T | undefined {
  if (!name.trim()) return undefined;
  const n = norm(name);
  return list.find((x) => norm(x.name) === n);
}
