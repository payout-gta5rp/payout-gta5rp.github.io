import { describe, expect, it } from "vitest";
import { calcWeek } from "./calc";
import { buildDemo as buildWorkspace } from "@/dev/demo";

describe("LSPD — сверка с WPS «К выплате» за 21.09–27.09.2026", () => {
  const ws = buildWorkspace("lspd");
  const r = calcWeek(ws.config, ws.employees, ws.current.entries);

  // [id, баллы, начислено, комиссия, к выдаче] — значения из таблицы WPS
  const expected: [string, number, number, number, number][] = [
    ["e01", 478, 239000, 6955, 232045],
    ["e02", 414, 250000, 7275, 242725], // 414×500×130% = 269 100 → лимит 250 000
    ["e03", 490, 250000, 7275, 242725],
    ["e04", 314, 204100, 5939, 198161],
    ["e05", 486, 250000, 7275, 242725],
    ["e06", 251, 163150, 4748, 158402],
    ["e11", 237, 130350, 3793, 126557],
  ];

  it.each(expected)("%s", (id, points, gross, commission, net) => {
    const l = r.lines[id];
    expect(l.points).toBe(points);
    expect(l.gross).toBe(gross);
    expect(l.commission).toBe(commission);
    expect(l.net).toBe(net);
  });

  it("итоги совпадают с шапкой «К выплате»", () => {
    expect(r.totals.points).toBe(2670);
    expect(r.totals.gross).toBe(1486600);
    expect(r.totals.members).toBe(7);
    expect(r.totals.commission).toBe(43260);
    expect(r.totals.net).toBe(1443340);
    expect(r.totals.unpaidNet).toBe(0);
  });

  it("лидер недели — e03 (490 баллов)", () => {
    expect(r.leader?.employeeId).toBe("e03");
  });

  it("у нулевых сотрудников ничего не начисляется", () => {
    expect(r.lines["e07"].gross).toBe(0);
    expect(r.lines["e07"].commission).toBe(0);
  });
});

describe("SASPA — бюджет, веса, доли", () => {
  const ws = buildWorkspace("saspa");
  const r = calcWeek(ws.config, ws.employees, ws.current.entries);

  it("офис получает фиксированные ставки", () => {
    expect(r.lines["s01"].gross).toBe(250000);
    expect(r.lines["s02"].gross).toBe(200000);
  });

  it("бюджеты отделов: вниз до 1000, недостающие тысячи — отделам с наибольшей отброшенной частью", () => {
    // 3 000 000 − (250 000 + 200 000 × 3) = 2 150 000.
    // 15% = 322 500 → 322 000 (×4), 20% = 430 000 (×2) → в сумме 2 148 000, не хватает 2 000:
    // по 1 000 получают первые два отдела с остатком 500 (HRD, EMD).
    expect(["hrd", "emd", "iad", "erd", "fpw", "fpsd"].map((d) => r.depts[d].budget)).toEqual([
      323000, 323000, 322000, 430000, 322000, 430000,
    ]);
    const sum = ["hrd", "emd", "iad", "erd", "fpw", "fpsd"].reduce((s, d) => s + (r.depts[d].budget ?? 0), 0);
    expect(sum).toBe(2150000);
  });

  it("остаток после округления уходит наибольшей доле, сумма = бюджету отдела", () => {
    // 323 000 × 25% = 80 750 → 80 000 (×2), 50% = 161 500 → 161 000; остаток 2 000 → s05
    expect(r.lines["s06"].gross).toBe(80000);
    expect(r.lines["s05"].gross).toBe(163000);
    expect(r.depts["hrd"].gross).toBe(323000);
  });
});
