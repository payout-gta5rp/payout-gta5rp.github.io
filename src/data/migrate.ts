import type { OrgConfig } from "@/engine/types";
import type { Workspace } from "./templates";

/**
 * Версия схемы сохранённых данных. Повышаем при изменении формы данных и дописываем шаг в migrateWorkspace.
 * v1 → v2: новые необязательные поля (Department.pointPrice, ActionDef.maxPerWeek, Entry.paidAmount) —
 * старые данные совместимы, приводим только обязательные массивы и правила.
 * v2 → v3: флаг onboarded (чистый лист при первом запуске); у существующих данных считаем true.
 */
export const SCHEMA_VERSION = 3;

export function migrateWorkspace<T extends Partial<Workspace>>(ws: T): T {
  const out = structuredClone(ws);
  const fixConfig = (c?: OrgConfig) => {
    if (!c) return;
    c.departments ??= [];
    c.positions ??= [];
    c.actions ??= [];
    c.methods ??= [{ id: "cash", name: "Наличными", commissionPct: 0 }];
    c.rules = {
      currency: "$",
      pointPrice: 0,
      weeklyCap: null,
      rounding: { mode: "none", step: 1 },
      remainder: "none",
      budget: 0,
      defaultMethodId: c.methods[0].id,
      ...(c.rules as Partial<OrgConfig["rules"]> | undefined),
    } as OrgConfig["rules"];
  };
  fixConfig(out.config);
  for (const w of out.archive ?? []) fixConfig(w.config);
  for (const e of Object.values(out.current?.entries ?? {})) e.adjustments ??= [];
  if (out.config && out.onboarded === undefined) (out as Partial<Workspace>).onboarded = true;
  return out;
}

