import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";
import { buildReport } from "./report";
import { buildDemo as buildWorkspace } from "@/dev/demo";

describe("отчёт .xlsx", () => {
  it("LSPD: листы, итоги и формулы", async () => {
    const ws = buildWorkspace("lspd");
    const buf = await buildReport({
      id: "t",
      start: ws.current.start,
      closedAt: new Date().toISOString(),
      config: ws.config,
      members: ws.employees,
      entries: ws.current.entries,
    });
    if (process.env.REPORT_OUT) writeFileSync(process.env.REPORT_OUT, Buffer.from(buf));

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Итог", "Детализация", "Тарифы"]);

    const sum = wb.getWorksheet("Итог")!;
    // Ищем строку ИТОГО
    let totalRow = 0;
    sum.eachRow((row, n) => {
      if (row.getCell(1).value === "ИТОГО") totalRow = n;
    });
    expect(totalRow).toBeGreaterThan(0);
    const g = sum.getCell(totalRow, 7).value as { formula: string; result: number };
    expect(g.formula).toMatch(/^SUM\(G9:G\d+\)$/);
    expect(g.result).toBe(1486600);
    expect((sum.getCell(totalRow, 10).value as { result: number }).result).toBe(1443340);

    const det = wb.getWorksheet("Детализация")!;
    const firstGross = det.getRow(5).values as unknown[];
    const grossCell = firstGross[firstGross.length - 1] as { formula: string; result: number };
    expect(grossCell.formula).toContain("Тарифы!$B$3");
    expect(grossCell.formula).toContain("MIN(");
  });
});
