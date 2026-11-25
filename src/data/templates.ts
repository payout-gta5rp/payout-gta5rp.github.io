import type { ActionDef, ClosedWeek, Employee, Entry, OrgConfig } from "@/engine/types";

/**
 * Пресеты правил для новых организаций. Здесь только настройки — без людей и выплат.
 * Демо-данные для разработки лежат в src/dev/demo.ts и в продакшен-сборку не попадают.
 */

export interface Workspace {
  config: OrgConfig;
  employees: Employee[];
  current: { start: string; entries: Record<string, Entry> };
  archive: ClosedWeek[];
  demo?: boolean;
  /** false — организация ещё не создана, показываем приветствие. */
  onboarded?: boolean;
}

// ─────────────────────────── LSPD ───────────────────────────

const A = (id: string, code: string, group: string, short: string, name: string, points: number): ActionDef => ({
  id,
  code,
  group,
  short,
  name,
  points,
});

const LSPD_ACTIONS: ActionDef[] = [
  A("pb01", "PB-01", "PB", "Штраф", "Штраф — один оформленный эпизод", 1),
  A("pb02", "PB-02", "PB", "Арест", "Заключение под стражу / арест", 2),
  A("pb03", "PB-03", "PB", "Вызов гражд.", "Закрытый вызов гражданского", 3),
  A("pb04", "PB-04", "PB", "Угонка", "Возврат угнанного транспорта", 7),
  A("pb05", "PB-05", "PB", "«Бабочка»", "Возврат «бабочки»", 8),
  A("pb06", "PB-06", "PB", "EMS", "Завершённое дежурство в EMS", 12),
  A("pb07", "PB-07", "PB", "СО", "Участие в СО, кроме поставки", 15),
  A("pb08", "PB-08", "PB", "Поставка", "Участие в поставке", 25),
  A("cis01", "CIS-01", "CIS", "Ср. улика", "Средняя улика", 4),
  A("cis02", "CIS-02", "CIS", "Мощн. улика", "Мощная улика", 20),
  A("cis03", "CIS-03", "CIS", "Лид. улика", "Лидерская улика", 24),
  A("cis04", "CIS-04", "CIS", "Допрос", "Допрос", 12),
  A("cis05", "CIS-05", "CIS", "Кейс", "Завершённый кейс", 45),
  A("cis06", "CIS-06", "CIS", "Лид. кейс", "Лидерский кейс", 70),
  A("pai01", "PAI-01", "PAI", "Набор", "Проведение набора", 20),
  A("pai02", "PAI-02", "PAI", "Помощь", "Помощь в проведении набора", 10),
  A("pai03", "PAI-03", "PAI", "Экзамен", "Принятие экзамена / переаттестации", 5),
  A("pai04", "PAI-04", "PAI", "Отчёт", "Проверка отчёта", 2),
  A("pai05", "PAI-05", "PAI", "Стажёр", "Стажёр завершил стажировку", 18),
  A("iad01", "IAD-01", "IAD", "Переаттест.", "Принятие переаттестации", 5),
  A("iad02", "IAD-02", "IAD", "Дисц. взыск.", "Обоснованное дисциплинарное взыскание", 4),
  A("gen01", "GEN-01", "SWAT / Общее", "Рейд", "Участие в рейде", 30),
  A("gen02", "GEN-02", "SWAT / Общее", "МП / ГМП", "Участие в МП / ГМП", 15),
  A("gen03", "GEN-03", "SWAT / Общее", "Напис. МП", "Написание МП / ГМП", 25),
  A("gen04", "GEN-04", "SWAT / Общее", "Вызов ст.", "Вызов старшего состава на задержание", 2),
  A("gen05", "GEN-05", "SWAT / Общее", "Принятие", "Принятие человека во фракцию", 1),
  A("gen06", "GEN-06", "SWAT / Общее", "Другое", "Другое", 1),
];

export const LSPD_CONFIG: OrgConfig = {
  name: "Los Santos Police Department",
  short: "LSPD",
  departments: [
    { id: "chief", name: "Офис шефа", color: "#b8860b", mode: "points" },
    { id: "pb", name: "PB", color: "#4f8cff", mode: "points" },
    { id: "cis", name: "CIS", color: "#14a58a", mode: "points" },
    { id: "pai", name: "PAI", color: "#9466f5", mode: "points" },
    { id: "swat", name: "SWAT", color: "#ef5350", mode: "points" },
    { id: "iad", name: "IAD", color: "#c34fcb", mode: "points" },
  ],
  positions: [
    { id: "chief", name: "Шеф", multiplier: 100 },
    { id: "dchief", name: "Заместитель Шефа", multiplier: 130 },
    { id: "head", name: "Начальник отдела", multiplier: 120 },
    { id: "dhead", name: "Заместитель начальника отдела", multiplier: 110 },
    { id: "insp", name: "Инспектор", multiplier: 100 },
    { id: "major", name: "Майор", multiplier: 100 },
    { id: "capt", name: "Капитан", multiplier: 100 },
    { id: "lt", name: "Лейтенант", multiplier: 100 },
    { id: "sgt", name: "Сержант", multiplier: 100 },
    { id: "cpl", name: "Капрал", multiplier: 100 },
    { id: "off", name: "Офицер", multiplier: 100 },
    { id: "joff", name: "Младший офицер", multiplier: 100 },
    { id: "cadet", name: "Офицер-стажёр", multiplier: 100 },
  ],
  actions: LSPD_ACTIONS,
  methods: [
    { id: "cash", name: "Наличными", commissionPct: 0 },
    { id: "wire", name: "Электронно", commissionPct: 2.91 },
  ],
  rules: {
    currency: "GTA$",
    pointPrice: 500,
    weeklyCap: 250000,
    rounding: { mode: "none", step: 1 },
    remainder: "none",
    budget: 0,
    defaultMethodId: "wire",
  },
};

// ─────────────────────────── SASPA ───────────────────────────

export const SASPA_CONFIG: OrgConfig = {
  name: "San Andreas State Prison Authority",
  short: "SASPA",
  departments: [
    { id: "office", name: "Офис", color: "#b8860b", mode: "fixed" },
    { id: "hrd", name: "HRD", color: "#4f8cff", mode: "budgetShare", weight: 15 },
    { id: "emd", name: "EMD", color: "#14a58a", mode: "budgetShare", weight: 15 },
    { id: "iad", name: "IAD", color: "#ef5350", mode: "budgetShare", weight: 15 },
    { id: "erd", name: "ERD", color: "#9466f5", mode: "budgetShare", weight: 20 },
    { id: "fpw", name: "FPW", color: "#6f9a1f", mode: "budgetShare", weight: 15 },
    { id: "fpsd", name: "FPSD", color: "#c34fcb", mode: "budgetShare", weight: 20 },
  ],
  positions: [
    { id: "warden", name: "Начальник тюрьмы", multiplier: 100, fixedRate: 250000 },
    { id: "dwarden", name: "Заместитель начальника тюрьмы", multiplier: 100, fixedRate: 200000 },
    { id: "commandant", name: "Комендант", multiplier: 100, fixedRate: 200000 },
    { id: "head", name: "Начальник отдела", multiplier: 100 },
    { id: "dhead", name: "Заместитель начальника отдела", multiplier: 100 },
    { id: "staff", name: "Сотрудник", multiplier: 100 },
  ],
  actions: [],
  methods: [{ id: "cash", name: "Наличными", commissionPct: 0 }],
  rules: {
    currency: "$",
    pointPrice: 0,
    weeklyCap: null,
    rounding: { mode: "floor", step: 1000 },
    remainder: "largest",
    budget: 3000000,
    defaultMethodId: "cash",
  },
};

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function mondayOf(d: Date): string {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - day);
  return dt.toISOString().slice(0, 10);
}

export function blankConfig(): OrgConfig {
  return {
    name: "",
    short: "",
    departments: [{ id: "d1", name: "Отдел 1", color: "#4f8cff", mode: "points" }],
    positions: [{ id: "p1", name: "Сотрудник", multiplier: 100 }],
    actions: [],
    methods: [{ id: "cash", name: "Наличными", commissionPct: 0 }],
    rules: {
      currency: "$",
      pointPrice: 100,
      weeklyCap: null,
      rounding: { mode: "none", step: 1 },
      remainder: "none",
      budget: 0,
      defaultMethodId: "cash",
    },
  };
}

/** Чистый лист: организация ещё не создана. */
export function emptyWorkspace(): Workspace {
  return {
    config: blankConfig(),
    employees: [],
    current: { start: mondayOf(new Date()), entries: {} },
    archive: [],
    onboarded: false,
  };
}
