import { describe, expect, it } from "vitest";
import { calcWeek, normalizeShares } from "./calc";
import { SASPA_CONFIG, LSPD_CONFIG } from "@/data/templates";
import { buildDemo as buildWorkspace } from "@/dev/demo";
import { migrateWorkspace } from "@/data/migrate";
import type { Employee, Entry, OrgConfig } from "./types";

const emp = (id: string, deptId: string, positionId: string, passport = "1"): Employee => ({
  id,
  name: id,
  passport,
  deptId,
  positionId,
  active: true,
});
const share = (v: number): Entry => ({ counts: {}, share: v, adjustments: [], paid: false });

describe("SASPA — сверка с листами «Веса отделов» и «Неделя» Google-таблицы", () => {
  // В таблице: бюджет 1 500 000, офис — 6 ставок по 100 000 → остаток 900 000
  const config: OrgConfig = structuredClone(SASPA_CONFIG);
  config.rules.budget = 1500000;
  config.positions = [
    { id: "office", name: "Офис", multiplier: 100, fixedRate: 100000 },
    { id: "head", name: "Начальник отдела", multiplier: 100 },
    { id: "staff", name: "Сотрудник", multiplier: 100 },
  ];
  const members = [
    ...[1, 2, 3, 4, 5, 6].map((i) => emp("o" + i, "office", "office")),
    emp("h1", "hrd", "head"),
    emp("h2", "hrd", "staff"),
    emp("h3", "hrd", "staff"),
  ];
  const entries = { h1: share(50), h2: share(30), h3: share(20) };
  const r = calcWeek(config, members, entries);

  it("офис 600 000, остаток на отделы 900 000", () => {
    expect(r.budget).toEqual({ total: 1500000, fixed: 600000, pool: 900000 });
  });

  it("бюджеты отделов как в таблице (15/15/15/20/15/20 %)", () => {
    expect(["hrd", "emd", "iad", "erd", "fpw", "fpsd"].map((d) => r.depts[d].budget)).toEqual([
      135000, 135000, 135000, 180000, 135000, 180000,
    ]);
  });

  it("премия = FLOOR(бюджет × %, 1000), остаток — наибольшему % (как _fixWeekRounding)", () => {
    // 135 000 × 50% = 67 500 → 67 000 (+1 000 остатка), × 30% = 40 500 → 40 000, × 20% = 27 000
    expect([r.lines.h1.gross, r.lines.h2.gross, r.lines.h3.gross]).toEqual([68000, 40000, 27000]);
    expect(r.depts.hrd.gross).toBe(135000);
  });

  it("без предупреждений, когда всё сходится", () => {
    expect(r.warnings).toEqual([]);
  });
});

describe("Бюджет сходится без «Добить до бюджета»", () => {
  // Детерминированный генератор, чтобы тест был воспроизводимым
  const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const splitTo100 = (n: number, r: () => number) => {
    const raw = Array.from({ length: n }, () => 1 + r() * 9);
    const s = raw.reduce((a, b) => a + b, 0);
    const out = raw.map((x) => Math.round((x / s) * 1000) / 10);
    out[n - 1] = Math.round((100 - out.slice(0, -1).reduce((a, b) => a + b, 0)) * 10) / 10;
    return out;
  };

  for (const mode of ["floor", "round"] as const)
    for (const remainder of ["largest", "proportional"] as const)
      it(`${mode} + ${remainder}: начислено ровно бюджет на 300 случайных неделях`, () => {
        const r = rng(mode.length * 7 + remainder.length);
        for (let run = 0; run < 300; run++) {
          const cfg = structuredClone(SASPA_CONFIG);
          cfg.rules.rounding = { mode, step: 1000 };
          cfg.rules.remainder = remainder;
          cfg.rules.budget = (1000 + Math.floor(r() * 4000)) * 1000;
          const share = cfg.departments.filter((d) => d.mode === "budgetShare");
          splitTo100(share.length, r).forEach((w, i) => (share[i].weight = w));
          const members: Employee[] = [emp("w", "office", "warden"), emp("d", "office", "dwarden")];
          const entries: Record<string, Entry> = {};
          for (const d of share) {
            const n = 1 + Math.floor(r() * 6);
            splitTo100(n, r).forEach((s, i) => {
              const id = `${d.id}-${i}`;
              members.push(emp(id, d.id, "staff"));
              entries[id] = { counts: {}, share: s, adjustments: [], paid: false };
            });
          }
          const res = calcWeek(cfg, members, entries);
          expect(res.totals.gross).toBe(cfg.rules.budget);
          // все суммы кратны 1000
          for (const l of Object.values(res.lines)) expect(l.gross % 1000).toBe(0);
        }
      });

  it("если бюджет не делится на шаг — предупреждение, а не тихая потеря", () => {
    const cfg = structuredClone(SASPA_CONFIG);
    cfg.rules.budget = 3000500;
    const res = calcWeek(cfg, [emp("w", "office", "warden")], {});
    expect(res.warnings.map((w) => w.kind)).toContain("budgetResidue");
  });
});

describe("Новые правила", () => {
  it("своя цена балла отдела", () => {
    const ws = buildWorkspace("lspd");
    const cfg = structuredClone(ws.config);
    cfg.departments.find((d) => d.id === "pai")!.pointPrice = 1000;
    const r = calcWeek(cfg, ws.employees, ws.current.entries);
    // e11 (Victor Lane): 237 баллов × 1000 × 110% = 260 700 → лимит 250 000
    expect(r.lines.e11.gross).toBe(250000);
    // Офис шефа по-прежнему по 500
    expect(r.lines.e01.gross).toBe(239000);
  });

  it("превышение обычного максимума действия — предупреждение, но не запрет", () => {
    const ws = buildWorkspace("lspd");
    const cfg = structuredClone(ws.config);
    cfg.actions.find((a) => a.id === "gen06")!.maxPerWeek = 20;
    const r = calcWeek(cfg, ws.employees, ws.current.entries);
    const w = r.warnings.filter((x) => x.kind === "actionMax");
    expect(w.map((x) => x.employeeId).sort()).toEqual(["e01", "e02"]); // «Другое» 50 и 60
    expect(r.lines.e01.gross).toBe(239000);
  });

  it("предупреждения: сумма % ≠ 100, веса ≠ 100, ставки больше бюджета, нет паспорта", () => {
    const cfg = structuredClone(SASPA_CONFIG);
    cfg.departments.find((d) => d.id === "hrd")!.weight = 10;
    cfg.rules.budget = 100000;
    const members = [emp("w", "office", "warden"), emp("a", "hrd", "staff", ""), emp("b", "hrd", "staff")];
    const r = calcWeek(cfg, members, { a: share(40), b: share(30) });
    const kinds = r.warnings.map((w) => w.kind).sort();
    // бюджет меньше ставок → отделам 0, поэтому «нет паспорта» не выдаётся (нечего выдавать)
    expect(kinds).toEqual(["budgetOverrun", "shareSum", "weightSum"]);

    cfg.rules.budget = 1000000;
    const r2 = calcWeek(cfg, members, { a: share(40), b: share(30) });
    expect(r2.warnings.map((w) => w.kind).sort()).toEqual(["noPassport", "shareSum", "weightSum"]);
  });

  it("normalizeShares растягивает до 100% и сохраняет пропорции", () => {
    expect(normalizeShares({ a: 40, b: 30, c: 0 })).toEqual({ a: 57.1, b: 42.9 });
    const n = normalizeShares({ a: 1, b: 1, c: 1 });
    expect(Object.values(n).reduce((s, v) => s + v, 0)).toBeCloseTo(100, 5);
  });
});

describe("Миграция сохранённых данных", () => {
  it("старые данные без новых полей открываются и считаются", () => {
    const old = JSON.parse(JSON.stringify(buildWorkspace("lspd")));
    delete old.config.rules.rounding;
    for (const e of Object.values(old.current.entries) as Entry[]) delete (e as Partial<Entry>).adjustments;
    const ws = migrateWorkspace(old);
    expect(ws.config.rules.rounding).toEqual({ mode: "none", step: 1 });
    const r = calcWeek(ws.config, ws.employees, ws.current.entries);
    expect(r.totals.gross).toBe(1486600);
  });

  it("шаблон LSPD не изменился", () => {
    expect(LSPD_CONFIG.rules.pointPrice).toBe(500);
  });
});
