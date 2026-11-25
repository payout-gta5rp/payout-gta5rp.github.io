import type * as ExcelTypes from "exceljs";
import { calcWeek } from "@/engine/calc";
import type { ClosedWeek, OrgConfig } from "@/engine/types";
import { dmy } from "@/lib/format";
import { useStore } from "@/store";

/**
 * Отчёт для админов (.xlsx, открывается в WPS / Excel / Google Таблицах).
 * Листы: «Итог» — ведомость, «Детализация» — откуда взялась каждая сумма (с формулами),
 * «Тарифы» — снимок настроек недели.
 */

type Excel = typeof ExcelTypes;

async function loadExcel(): Promise<Excel> {
  // Браузерная сборка ExcelJS, грузится только при экспорте
  const mod = (await import("exceljs/dist/exceljs.min.js")) as unknown as { default: Excel };
  return mod.default;
}

const DARK = "FF141A2B";
const MID = "FF2B3350";
const LINE = "FFD9DCE5";
const MONEY = '#,##0';

const argb = (hex: string, alpha = "FF") => alpha + hex.replace("#", "").toUpperCase();
/** Светлый оттенок цвета отдела для заливки в светлой таблице. */
function tint(hex: string, k = 0.82): string {
  const h = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const t = c.map((v) => Math.round(v + (255 - v) * k));
  return "FF" + t.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function thin(cell: ExcelTypes.Cell) {
  const s = { style: "thin" as const, color: { argb: LINE } };
  cell.border = { top: s, left: s, bottom: s, right: s };
}

export async function downloadCurrentReport() {
  const s = useStore.getState();
  const week: ClosedWeek = {
    id: "current",
    start: s.current.start,
    closedAt: new Date().toISOString(),
    config: s.config,
    members: s.employees,
    entries: s.current.entries,
  };
  await downloadWeekReport(week, true);
}

export async function downloadWeekReport(week: ClosedWeek, draft = false) {
  const buf = await buildReport(week, draft);
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const end = new Date(Date.parse(week.start) + 6 * 864e5).toISOString().slice(0, 10);
  const name = `${week.config.short}_выплаты_${dmy(week.start)}-${dmy(end)}${draft ? "_черновик" : ""}.xlsx`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function buildReport(week: ClosedWeek, draft = false): Promise<ArrayBuffer> {
  const ExcelJS = await loadExcel();
  const cfg = week.config;
  const calc = calcWeek(cfg, week.members, week.entries);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Payout";
  wb.created = new Date();

  const end = new Date(Date.parse(week.start) + 6 * 864e5).toISOString().slice(0, 10);
  const periodText = `${dmy(week.start)} — ${dmy(end)}`;
  const deptById = new Map(cfg.departments.map((d) => [d.id, d]));
  const posById = new Map(cfg.positions.map((p) => [p.id, p]));
  const methodById = new Map(cfg.methods.map((m) => [m.id, m]));
  const memberById = new Map(week.members.map((m) => [m.id, m]));

  // Порядок строк: по отделам, внутри — по порядку должностей и имени
  const pIdx = new Map(cfg.positions.map((p, i) => [p.id, i]));
  const ordered = cfg.departments.map((d) => ({
    dept: d,
    lines: Object.values(calc.lines)
      .filter((l) => l.deptId === d.id && l.gross > 0)
      .sort((a, b) => {
        const ma = memberById.get(a.employeeId)!;
        const mb = memberById.get(b.employeeId)!;
        return (pIdx.get(ma.positionId) ?? 99) - (pIdx.get(mb.positionId) ?? 99) || ma.name.localeCompare(mb.name);
      }),
  }));

  // Листы создаём сразу в нужном порядке: Итог, Детализация, Тарифы
  const ws = wb.addWorksheet("Итог", {
    properties: { tabColor: { argb: "FF34D399" } },
    views: [{ state: "frozen", ySplit: 8, showGridLines: false }],
  });
  const pointsDepts = cfg.departments.filter((d) => d.mode === "points");
  const acts = cfg.actions.filter((a) => !a.archived);
  const ds =
    pointsDepts.length && acts.length
      ? wb.addWorksheet("Детализация", {
          properties: { tabColor: { argb: "FF22D3EE" } },
          views: [{ state: "frozen", xSplit: 3, ySplit: 4, showGridLines: false }],
        })
      : null;
  const tr = wb.addWorksheet("Тарифы", { properties: { tabColor: { argb: "FF8B6CFF" } } });

  // ───────────── Тарифы ─────────────
  tr.columns = [{ width: 34 }, { width: 18 }, { width: 44 }, { width: 12 }];
  tr.getCell("A1").value = `${cfg.short} // ТАРИФЫ НЕДЕЛИ ${periodText}`;
  tr.getCell("A1").font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  tr.mergeCells("A1:D1");
  tr.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
  tr.getRow(1).height = 26;
  const kv: [string, number | string | null, string?][] = [
    ["Цена балла", cfg.rules.pointPrice, MONEY],
    ["Недельный максимум", cfg.rules.weeklyCap ?? "нет", MONEY],
    ["Общий бюджет", cfg.rules.budget || "—", MONEY],
    ["Валюта", cfg.rules.currency],
  ];
  kv.forEach(([k, v, f], i) => {
    const r = 3 + i;
    tr.getCell(`A${r}`).value = k;
    tr.getCell(`A${r}`).font = { bold: true };
    const c = tr.getCell(`B${r}`);
    c.value = v;
    if (f) c.numFmt = f;
    c.font = { bold: true, color: { argb: "FF3B5BDB" } };
  });
  const PRICE = "Тарифы!$B$3";
  const CAP = "Тарифы!$B$4";

  let r = 8;
  const head = (row: number, titles: string[]) => {
    titles.forEach((t, i) => {
      const c = tr.getCell(row, i + 1);
      c.value = t;
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MID } };
      thin(c);
    });
  };
  if (cfg.actions.length) {
    head(r, ["Действие", "Код", "Блок", "Баллы"]);
    for (const a of cfg.actions.filter((x) => !x.archived)) {
      r++;
      [a.name, a.code, a.group, a.points].forEach((v, i) => {
        const c = tr.getCell(r, i + 1);
        c.value = v;
        thin(c);
      });
    }
    r += 2;
  }
  head(r, ["Должность", "Множитель, %", "Ставка", "Лимит"]);
  for (const p of cfg.positions) {
    r++;
    [p.name, p.multiplier, p.fixedRate ?? "", p.cap ?? ""].forEach((v, i) => {
      const c = tr.getCell(r, i + 1);
      c.value = v as string | number;
      if (i >= 2) c.numFmt = MONEY;
      thin(c);
    });
  }
  r += 2;
  head(r, ["Способ выплаты", "Комиссия, %", "", ""]);
  for (const m of cfg.methods) {
    r++;
    tr.getCell(r, 1).value = m.name;
    tr.getCell(r, 2).value = m.commissionPct;
    thin(tr.getCell(r, 1));
    thin(tr.getCell(r, 2));
  }
  if (cfg.departments.some((d) => d.mode === "budgetShare" || d.pointPrice != null)) {
    r += 2;
    head(r, ["Отдел", "Основа", "Вес % / цена балла", "Бюджет"]);
    for (const d of cfg.departments) {
      r++;
      const param = d.mode === "budgetShare" ? d.weight ?? "" : d.mode === "points" ? d.pointPrice ?? cfg.rules.pointPrice : "";
      [d.name, modeName(d.mode), param, calc.depts[d.id]?.budget ?? ""].forEach((v, i) => {
        const c = tr.getCell(r, i + 1);
        c.value = v as string | number;
        if (i === 3) c.numFmt = MONEY;
        thin(c);
      });
    }
  }

  // ───────────── Итог ─────────────
  const COLS = [
    { h: "№", w: 5 },
    { h: "Отдел", w: 12 },
    { h: "Должность", w: 28 },
    { h: "Сотрудник", w: 26 },
    { h: "№ паспорта", w: 13 },
    { h: "Баллы", w: 9 },
    { h: "Начислено", w: 14 },
    { h: "Способ", w: 13 },
    { h: "Комиссия", w: 12 },
    { h: "К выдаче", w: 14 },
    { h: "Статус", w: 12 },
    { h: "Дата выдачи", w: 13 },
    { h: "Примечание", w: 30 },
  ];
  ws.columns = COLS.map((c) => ({ width: c.w }));
  ws.mergeCells("A1:M1");
  ws.getCell("A1").value = `${cfg.short} // ВЕДОМОСТЬ НА ВЫПЛАТУ${draft ? " (черновик)" : ""}`;
  ws.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
  ws.getCell("A1").alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 30;
  ws.mergeCells("A2:M2");
  ws.getCell("A2").value = `${cfg.name} · период ${periodText} · сформировано ${new Date().toLocaleString("ru-RU")} в Payout`;
  ws.getCell("A2").font = { italic: true, color: { argb: "FF6B7280" } };
  ws.getCell("A2").alignment = { indent: 1 };

  const firstRow = 9;
  const kpiRow = 4;

  // Заголовок таблицы
  const hr = ws.getRow(8);
  COLS.forEach((c, i) => {
    const cell = hr.getCell(i + 1);
    cell.value = c.h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MID } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    thin(cell);
  });
  hr.height = 24;

  let row = firstRow;
  let n = 0;
  const dataRows: number[] = [];
  for (const g of ordered) {
    if (!g.lines.length) continue;
    ws.mergeCells(row, 1, row, 13);
    const band = ws.getCell(row, 1);
    band.value = `${g.dept.name}  ·  ${g.lines.length} чел.`;
    band.font = { bold: true, color: { argb: argb(g.dept.color) } };
    band.fill = { type: "pattern", pattern: "solid", fgColor: { argb: tint(g.dept.color, 0.88) } };
    band.alignment = { indent: 1 };
    row++;
    for (const l of g.lines) {
      const m = memberById.get(l.employeeId)!;
      const e = week.entries[l.employeeId];
      const method = methodById.get(l.methodId);
      n++;
      const values: (string | number | ExcelTypes.CellFormulaValue | null)[] = [
        n,
        g.dept.name,
        posById.get(m.positionId)?.name ?? "",
        m.name,
        m.passport,
        deptById.get(m.deptId)?.mode === "points" ? l.points : null,
        l.gross,
        method?.name ?? "",
        l.commission,
        { formula: `G${row}-I${row}`, result: l.net },
        l.paid ? "Выдано" : "Не выдано",
        e?.paidAt && l.paid ? dmy(e.paidAt) : "",
        [e?.note, ...(e?.adjustments ?? []).map((a) => `${a.amount > 0 ? "+" : ""}${a.amount} ${a.reason}`), l.capped ? "лимит" : ""]
          .filter(Boolean)
          .join("; "),
      ];
      values.forEach((v, i) => {
        const c = ws.getCell(row, i + 1);
        c.value = v as ExcelTypes.CellValue;
        thin(c);
        c.alignment = { vertical: "middle", horizontal: i === 3 || i === 2 || i === 12 ? "left" : "center" };
        if ([6, 8, 9].includes(i)) c.numFmt = MONEY;
      });
      ws.getCell(row, 5).numFmt = "@";
      ws.getCell(row, 10).font = { bold: true };
      const st = ws.getCell(row, 11);
      st.font = { bold: true, color: { argb: l.paid ? "FF1E7B4C" : "FFB4232C" } };
      st.fill = { type: "pattern", pattern: "solid", fgColor: { argb: l.paid ? "FFDCF5E8" : "FFFDE2E4" } };
      dataRows.push(row);
      row++;
    }
  }

  // Итоговая строка
  const last = row - 1;
  const total = row;
  ws.mergeCells(total, 1, total, 5);
  ws.getCell(total, 1).value = "ИТОГО";
  const sumCols: [number, string, number][] = [
    [6, "F", calc.totals.points],
    [7, "G", calc.totals.gross],
    [9, "I", calc.totals.commission],
    [10, "J", calc.totals.net],
  ];
  for (const [ci, letter, result] of sumCols) {
    ws.getCell(total, ci).value = { formula: `SUM(${letter}${firstRow}:${letter}${last})`, result };
    ws.getCell(total, ci).numFmt = MONEY;
  }
  for (let ci = 1; ci <= 13; ci++) {
    const c = ws.getCell(total, ci);
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
    c.alignment = { horizontal: ci === 1 ? "right" : "center", vertical: "middle" };
  }
  ws.getRow(total).height = 22;

  // KPI-плашки (с формулами по таблице)
  const rng = (col: string) => `${col}${firstRow}:${col}${last}`;
  const kpis: [string, ExcelTypes.CellFormulaValue, string?][] = [
    ["Сотрудников", { formula: `COUNTA(${rng("D")})`, result: calc.totals.members }],
    ["Баллы", { formula: `SUM(${rng("F")})`, result: calc.totals.points }, MONEY],
    ["Начислено", { formula: `SUM(${rng("G")})`, result: calc.totals.gross }, MONEY],
    ["Комиссия", { formula: `SUM(${rng("I")})`, result: calc.totals.commission }, MONEY],
    ["К выдаче", { formula: `SUM(${rng("J")})`, result: calc.totals.net }, MONEY],
    ["Выдано", { formula: `SUMIF(${rng("K")},"Выдано",${rng("J")})`, result: calc.totals.paidNet }, MONEY],
    ["Не выдано", { formula: `SUMIF(${rng("K")},"Не выдано",${rng("J")})`, result: calc.totals.unpaidNet }, MONEY],
  ];
  // 7 плашек на 13 колонок: A:B, C, D:F, G:H, I, J:K, L:M
  const kpiCols = [1, 3, 4, 7, 9, 10, 12];
  const kpiSpans = [2, 1, 3, 2, 1, 2, 2];
  kpis.forEach(([label, f, fmtStr], i) => {
    const col = kpiCols[i];
    const span = kpiSpans[i];
    if (span > 1) {
      ws.mergeCells(kpiRow, col, kpiRow, col + span - 1);
      ws.mergeCells(kpiRow + 1, col, kpiRow + 1, col + span - 1);
    }
    const lc = ws.getCell(kpiRow, col);
    lc.value = label.toUpperCase();
    lc.font = { size: 9, bold: true, color: { argb: "FF6B7280" } };
    lc.alignment = { horizontal: "center" };
    const vc = ws.getCell(kpiRow + 1, col);
    vc.value = f;
    if (fmtStr) vc.numFmt = fmtStr;
    vc.font = { size: 14, bold: true, color: { argb: i === 6 && calc.totals.unpaidNet > 0 ? "FFB4232C" : "FF141A2B" } };
    vc.alignment = { horizontal: "center" };
  });
  ws.getRow(kpiRow + 1).height = 22;
  ws.autoFilter = { from: { row: 8, column: 1 }, to: { row: Math.max(8, last), column: 13 } };

  // ───────────── Детализация ─────────────
  if (ds) {
    const A0 = 4; // первая колонка действий
    const lastAct = A0 + acts.length - 1;
    const col = (i: number) => ds.getColumn(i).letter;
    const cPoints = lastAct + 1;
    const cMult = lastAct + 2;
    const cAdj = lastAct + 3;
    const cCap = lastAct + 4;
    const cGross = lastAct + 5;
    ds.getColumn(1).width = 24;
    ds.getColumn(2).width = 12;
    ds.getColumn(3).width = 26;
    for (let i = A0; i <= lastAct; i++) ds.getColumn(i).width = 8.5;
    [cPoints, cMult, cAdj, cCap, cGross].forEach((c, i) => (ds.getColumn(c).width = [9, 11, 14, 14, 15][i]));

    ds.mergeCells(1, 1, 1, cGross);
    ds.getCell(1, 1).value = `${cfg.short} // ДЕТАЛИЗАЦИЯ БАЛЛОВ ${periodText}`;
    ds.getCell(1, 1).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    ds.getCell(1, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
    ds.getRow(1).height = 26;
    ds.mergeCells(2, 1, 2, cGross);
    ds.getCell(2, 1).value =
      "Начислено = MIN(Баллы × Цена балла × Множитель / 100 + Корректировки; Лимит). Баллы = Σ(кол-во × баллы действия). Формулы живые — их можно проверить.";
    ds.getCell(2, 1).font = { italic: true, size: 9, color: { argb: "FF6B7280" } };

    // Строка 3 — баллы за единицу, строка 4 — заголовки
    ds.getCell(3, 3).value = "Баллы за единицу →";
    ds.getCell(3, 3).alignment = { horizontal: "right" };
    ds.getCell(3, 3).font = { italic: true, color: { argb: "FF6B7280" } };
    const headers = ["Сотрудник", "Отдел", "Должность"];
    headers.forEach((h, i) => (ds.getCell(4, i + 1).value = h));
    acts.forEach((a, i) => {
      ds.getCell(3, A0 + i).value = a.points;
      ds.getCell(3, A0 + i).font = { bold: true, color: { argb: "FF3B5BDB" } };
      ds.getCell(3, A0 + i).alignment = { horizontal: "center" };
      ds.getCell(4, A0 + i).value = a.short;
      ds.getCell(4, A0 + i).note = `${a.code}: ${a.name}`;
    });
    ["Баллы", "Множ., %", "Корректир.", "Лимит", "Начислено"].forEach((h, i) => (ds.getCell(4, cPoints + i).value = h));
    for (let c = 1; c <= cGross; c++) {
      const cell = ds.getCell(4, c);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MID } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      thin(cell);
    }
    ds.getRow(4).height = 34;

    let rr = 5;
    for (const g of ordered) {
      if (g.dept.mode !== "points" || !g.lines.length) continue;
      for (const l of g.lines) {
        const m = memberById.get(l.employeeId)!;
        const pos = posById.get(m.positionId);
        const e = week.entries[l.employeeId];
        ds.getCell(rr, 1).value = m.name;
        ds.getCell(rr, 2).value = g.dept.name;
        ds.getCell(rr, 3).value = pos?.name ?? "";
        acts.forEach((a, i) => {
          const v = e?.counts[a.id];
          const c = ds.getCell(rr, A0 + i);
          if (v) c.value = v;
          c.alignment = { horizontal: "center" };
          thin(c);
        });
        const range = `${col(A0)}${rr}:${col(lastAct)}${rr}`;
        const ptsRange = `$${col(A0)}$3:$${col(lastAct)}$3`;
        ds.getCell(rr, cPoints).value = { formula: `SUMPRODUCT(${range},${ptsRange})`, result: l.points };
        ds.getCell(rr, cMult).value = pos?.multiplier ?? 100;
        ds.getCell(rr, cAdj).value = l.adjustments || 0;
        const capVal = pos?.cap ?? cfg.rules.weeklyCap;
        ds.getCell(rr, cCap).value = capVal ?? "";
        const P = `${col(cPoints)}${rr}`;
        const M = `${col(cMult)}${rr}`;
        const J = `${col(cAdj)}${rr}`;
        const L = `${col(cCap)}${rr}`;
        const capRef = pos?.cap != null ? L : CAP;
        // Своя цена балла отдела пишется числом прямо в формулу, общая — ссылкой на «Тарифы»
        const price = g.dept.pointPrice != null && g.dept.pointPrice >= 0 ? String(g.dept.pointPrice) : PRICE;
        ds.getCell(rr, cGross).value = {
          formula:
            capVal != null
              ? `MIN(${P}*${price}*${M}/100+${J},${capRef})`
              : `${P}*${price}*${M}/100+${J}`,
          result: l.gross,
        };
        [cPoints, cMult, cAdj, cCap, cGross].forEach((c) => {
          const cell = ds.getCell(rr, c);
          thin(cell);
          cell.alignment = { horizontal: "center" };
          if (c !== cPoints && c !== cMult) cell.numFmt = MONEY;
        });
        ds.getCell(rr, cGross).font = { bold: true };
        ds.getCell(rr, 1).border = ds.getCell(rr, cGross).border;
        for (let c = 1; c <= 3; c++) {
          thin(ds.getCell(rr, c));
          ds.getCell(rr, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: tint(g.dept.color, 0.92) } };
        }
        rr++;
      }
    }
  }

  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: "visible" }];

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export function modeName(m: OrgConfig["departments"][number]["mode"]): string {
  return { points: "Баллы", budgetShare: "Доля бюджета", fixed: "Фикс. ставка", manual: "Вручную" }[m];
}
