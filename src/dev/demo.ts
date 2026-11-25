/**
 * Демо-данные для разработки и тестов. В продакшен-сборку не попадают:
 * подгружаются только при import.meta.env.DEV (см. «Настройки → Данные»).
 *
 * Имена и паспорта выдуманы. Количества действий LSPD взяты из реальной недели
 * WPS 21.09–27.09.2026 — тесты сверяют расчёт с той таблицей до рубля.
 */
import { addDays, LSPD_CONFIG, mondayOf, SASPA_CONFIG, type Workspace } from "@/data/templates";
import type { ClosedWeek, Employee, Entry, OrgConfig } from "@/engine/types";

export type DemoId = "lspd" | "saspa";

export const DEMOS: { id: DemoId; name: string; description: string }[] = [
  { id: "lspd", name: "LSPD — баллы за действия", description: "22 сотрудника, текущая неделя и 10 недель архива." },
  { id: "saspa", name: "SASPA — бюджет и доли", description: "Офис на ставках, 6 отделов на долях бюджета." },
];

type Row = [id: string, dept: string, pos: string, name: string, passport: string, counts?: Record<string, number>];

const LSPD_ROWS: Row[] = [
  ["e01", "chief", "chief", "Vivian Hale", "100101", { pb02: 3, pb07: 7, pb08: 8, cis04: 1, gen01: 3, gen04: 5, gen05: 5, gen06: 50 }],
  ["e02", "chief", "dchief", "Marcus Reed", "100102", { pb02: 2, pb07: 4, pb08: 4, pai01: 3, pai02: 2, gen01: 3, gen04: 9, gen05: 2, gen06: 60 }],
  ["e03", "chief", "dchief", "Nora Quinn", "100103", { pb02: 4, pb07: 7, pb08: 11, gen01: 3, gen04: 2, gen05: 8 }],
  ["e04", "chief", "dchief", "Dante Rivers", "100104", { pb02: 5, pb07: 3, pb08: 6, cis04: 1, gen01: 3, gen04: 1, gen05: 5 }],
  ["e05", "chief", "dchief", "Selena_Voss", "100105", { pb02: 2, pb07: 3, pb08: 5, cis02: 5, cis04: 2, cis05: 2, gen01: 3, gen04: 1, gen05: 6 }],
  ["e06", "chief", "dchief", "Owen Blake", "100106", { pb02: 4, pb07: 2, pb08: 3, pai01: 1, pai02: 2, gen01: 3, gen04: 2, gen05: 4 }],
  ["e07", "cis", "dhead", "Ivan_Morozov", "100107"],
  ["e08", "cis", "dhead", "Lena Park", "100108"],
  ["e09", "cis", "dhead", "Hugo_Stein", "100109"],
  ["e10", "pai", "head", "Felix_Grant", "100110"],
  ["e11", "pai", "dhead", "Victor Lane", "100111", { pai01: 8, pai03: 11, pai04: 7, gen05: 8 }],
  ["e12", "pai", "dhead", "Theo_Walsh", "100112"],
  ["e13", "pai", "insp", "Mila_Torres", "100113"],
  ["e14", "pai", "insp", "Ray_Collins", "100114"],
  ["e15", "swat", "head", "Kurt_Becker", "100115"],
  ["e16", "swat", "dhead", "Ada Novak", "100116"],
  ["e17", "swat", "dhead", "Boris Kane", "100117"],
  ["e18", "swat", "dhead", "Sam_Ortega", "100118"],
  ["e19", "iad", "head", "Gleb Sokolov", "100119"],
  ["e20", "iad", "dhead", "Paul Wright", "100120"],
  ["e21", "iad", "dhead", "Igor_Volkov", "100121"],
  ["e22", "iad", "dhead", "Rosa_Mendez", "100122"],
];

/** Детерминированный генератор, чтобы демо-архив был одинаковым при каждом сбросе. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function demoArchive(config: OrgConfig, employees: Employee[], currentStart: string, weeks: number): ClosedWeek[] {
  const r = rng(42);
  const actionIds = config.actions.map((a) => a.id);
  const out: ClosedWeek[] = [];
  for (let w = weeks; w >= 1; w--) {
    const start = addDays(currentStart, -7 * w);
    const entries: Record<string, Entry> = {};
    for (const e of employees) {
      const activity = r();
      if (activity < 0.35) continue; // не все активны каждую неделю
      const counts: Record<string, number> = {};
      const k = 2 + Math.floor(r() * 6);
      for (let i = 0; i < k; i++) {
        const a = actionIds[Math.floor(r() * actionIds.length)];
        const pts = config.actions.find((x) => x.id === a)!.points;
        const max = pts >= 40 ? 2 : pts >= 15 ? 6 : 12;
        counts[a] = (counts[a] ?? 0) + 1 + Math.floor(r() * max * activity);
      }
      entries[e.id] = {
        counts,
        adjustments: [],
        methodId: r() < 0.8 ? "wire" : "cash",
        paid: true,
        paidAt: addDays(start, 7) + "T18:00:00.000Z",
      };
    }
    out.push({
      id: "w-" + start,
      start,
      closedAt: addDays(start, 7) + "T20:00:00.000Z",
      config,
      members: employees.map((e) => ({ ...e })),
      entries,
    });
  }
  return out;
}

function lspdDemo(): Workspace {
  const employees: Employee[] = LSPD_ROWS.map(([id, deptId, positionId, name, passport]) => ({
    id,
    deptId,
    positionId,
    name,
    passport,
    active: true,
  }));
  const start = "2026-09-21";
  const entries: Record<string, Entry> = {};
  for (const [id, , , , , counts] of LSPD_ROWS) {
    if (!counts) continue;
    entries[id] = { counts: { ...counts }, adjustments: [], methodId: "wire", paid: true, paidAt: "2026-09-28T19:00:00.000Z" };
  }
  const config = structuredClone(LSPD_CONFIG);
  return { config, employees, current: { start, entries }, archive: demoArchive(config, employees, start, 10), demo: true, onboarded: true };
}

function saspaDemo(): Workspace {
  const rows: [string, string, string, string, string][] = [
    ["s01", "office", "warden", "Arthur Graves", "200201"],
    ["s02", "office", "dwarden", "Elena Frost", "200202"],
    ["s03", "office", "dwarden", "Leon Marsh", "200203"],
    ["s04", "office", "commandant", "Clara Holt", ""],
    ["s05", "hrd", "head", "Diego Cruz", "200205"],
    ["s06", "hrd", "dhead", "Nina Shaw", ""],
    ["s07", "hrd", "dhead", "Oscar Bell", ""],
    ["s08", "emd", "head", "Yuri Petrov", ""],
    ["s09", "emd", "dhead", "Kate Doyle", ""],
    ["s10", "iad", "head", "Mark Fisher", "200210"],
    ["s11", "iad", "dhead", "Liam Price", ""],
    ["s12", "erd", "head", "Zoe Adler", ""],
    ["s13", "erd", "dhead", "Ethan Cole", ""],
    ["s14", "fpw", "head", "Iris Wolfe", "200214"],
    ["s15", "fpsd", "head", "Adam Pierce", "200215"],
  ];
  const employees = rows.map(([id, deptId, positionId, name, passport]) => ({ id, deptId, positionId, name, passport, active: true }));
  const shares: Record<string, number> = {
    s05: 50, s06: 25, s07: 25, s08: 60, s09: 40, s10: 55, s11: 45, s12: 70, s13: 30, s14: 100, s15: 100,
  };
  const entries: Record<string, Entry> = {};
  for (const [id, share] of Object.entries(shares)) entries[id] = { counts: {}, share, adjustments: [], paid: false };
  return {
    config: structuredClone(SASPA_CONFIG),
    employees,
    current: { start: mondayOf(new Date()), entries },
    archive: [],
    demo: true,
    onboarded: true,
  };
}

export function buildDemo(id: DemoId): Workspace {
  return id === "saspa" ? saspaDemo() : lspdDemo();
}
