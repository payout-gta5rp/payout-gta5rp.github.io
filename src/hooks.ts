import { useMemo } from "react";
import { useStore } from "@/store";
import { calcWeek } from "@/engine/calc";
import type { ClosedWeek, Department, Employee, WeekCalc } from "@/engine/types";

/** Расчёт текущей (открытой) недели по текущим настройкам. */
export function useCurrentCalc(): WeekCalc {
  const config = useStore((s) => s.config);
  const employees = useStore((s) => s.employees);
  const entries = useStore((s) => s.current.entries);
  return useMemo(() => calcWeek(config, employees, entries), [config, employees, entries]);
}

export function calcClosed(w: ClosedWeek): WeekCalc {
  return calcWeek(w.config, w.members, w.entries);
}

/** Сотрудники, сгруппированные по отделам в порядке настроек. */
export function groupByDept(departments: Department[], employees: Employee[], positionsOrder: string[]) {
  const pIdx = new Map(positionsOrder.map((id, i) => [id, i]));
  return departments.map((d) => ({
    dept: d,
    employees: employees
      .filter((e) => e.deptId === d.id)
      .sort((a, b) => (pIdx.get(a.positionId) ?? 99) - (pIdx.get(b.positionId) ?? 99) || a.name.localeCompare(b.name)),
  }));
}

export function useArchiveCalcs() {
  const archive = useStore((s) => s.archive);
  return useMemo(
    () => archive.map((w) => ({ week: w, calc: calcClosed(w) })).sort((a, b) => a.week.start.localeCompare(b.week.start)),
    [archive],
  );
}
