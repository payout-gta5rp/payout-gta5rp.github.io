import { AlertTriangle, CheckCircle2, ClipboardPaste, PlusCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Department, Employee, OrgConfig, Position } from "@/engine/types";
import { cn } from "@/lib/format";
import { findByName, parseEmployees, type Field } from "@/lib/importParse";
import { uid } from "@/store";
import { Badge, Select } from "./ui";

export interface ImportPlan {
  employees: Omit<Employee, "id">[];
  newDepartments: Department[];
  newPositions: Position[];
}

const FIELD_LABEL: Record<Field, string> = {
  name: "Имя",
  passport: "Паспорт",
  dept: "Отдел",
  position: "Должность",
  skip: "— пропустить",
};
const PALETTE = ["#4f8cff", "#14a58a", "#9466f5", "#ef5350", "#c34fcb", "#6f9a1f", "#b8860b"];

/**
 * Вставка таблицы сотрудников → предпросмотр → план импорта.
 * Ничего не меняет сам: план применяет вызывающий (магазин или мастер).
 */
export function EmployeeImport({
  config,
  existing,
  onPlan,
}: {
  config: OrgConfig;
  existing: Employee[];
  onPlan: (plan: ImportPlan | null) => void;
}) {
  const [text, setText] = useState("");
  const [override, setOverride] = useState<Field[] | null>(null);
  const [create, setCreate] = useState(true);
  const [defDept, setDefDept] = useState(config.departments[0]?.id ?? "");
  const [defPos, setDefPos] = useState(config.positions[config.positions.length - 1]?.id ?? "");

  const parsed = useMemo(() => parseEmployees(text, override ?? undefined), [text, override]);

  const result = useMemo(() => {
    const newDepts: Department[] = [];
    const newPos: Position[] = [];
    const seenNames = new Set(existing.map((e) => e.name.toLowerCase()));
    const seenPass = new Set(existing.map((e) => e.passport).filter(Boolean));
    const rows = parsed.rows.map((r) => {
      let dept = findByName([...config.departments, ...newDepts], r.dept);
      if (!dept && r.dept && create) {
        dept = { id: uid(), name: r.dept, color: PALETTE[(config.departments.length + newDepts.length) % PALETTE.length], mode: "points" };
        newDepts.push(dept);
      }
      let pos = findByName([...config.positions, ...newPos], r.position);
      if (!pos && r.position && create) {
        pos = { id: uid(), name: r.position, multiplier: 100 };
        newPos.push(pos);
      }
      const dup = seenNames.has(r.name.toLowerCase()) || (r.passport && seenPass.has(r.passport));
      seenNames.add(r.name.toLowerCase());
      if (r.passport) seenPass.add(r.passport);
      const problem = !r.name ? "нет имени" : dup ? "уже есть" : null;
      return {
        ...r,
        deptId: dept?.id ?? defDept,
        deptName: dept?.name ?? config.departments.find((d) => d.id === defDept)?.name ?? "—",
        deptNew: !!dept && newDepts.includes(dept),
        positionId: pos?.id ?? defPos,
        posName: pos?.name ?? config.positions.find((p) => p.id === defPos)?.name ?? "—",
        posNew: !!pos && newPos.includes(pos),
        problem,
      };
    });
    const ok = rows.filter((r) => !r.problem);
    const usedDept = new Set(ok.map((r) => r.deptId));
    const usedPos = new Set(ok.map((r) => r.positionId));
    return {
      rows,
      plan:
        ok.length > 0
          ? {
              employees: ok.map((r) => ({ name: r.name, passport: r.passport, deptId: r.deptId, positionId: r.positionId, active: true })),
              newDepartments: newDepts.filter((d) => usedDept.has(d.id)),
              newPositions: newPos.filter((p) => usedPos.has(p.id)),
            }
          : null,
    };
  }, [parsed, config, existing, create, defDept, defPos]);

  // Сообщаем план наружу при каждом изменении
  const planKey = JSON.stringify(result.plan);
  useEffect(() => {
    onPlan(result.plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey]);

  const width = Math.max(parsed.columns.length, 0);

  return (
    <div className="space-y-4">
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOverride(null);
          }}
          rows={text ? 5 : 7}
          placeholder={"Скопируйте строки из WPS, Excel или Google Таблиц и вставьте сюда (Ctrl+V).\nМожно с заголовком: Имя · Паспорт · Отдел · Должность — колонки определятся сами."}
          className="w-full resize-y rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-4 font-mono text-[12.5px] text-fg outline-none placeholder:font-sans placeholder:text-[13px] placeholder:text-faint focus:border-accent/60 focus:ring-4 focus:ring-accent/15"
        />
        {!text && <ClipboardPaste size={22} className="pointer-events-none absolute right-4 top-4 text-faint" />}
      </div>

      {parsed.rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted">Колонки:</span>
            {Array.from({ length: width }).map((_, i) => (
              <Select
                key={i}
                className="h-8 w-auto text-xs"
                value={parsed.columns[i] ?? "skip"}
                onChange={(v) => {
                  const next = [...parsed.columns];
                  next[i] = v as Field;
                  setOverride(next);
                }}
                options={(Object.keys(FIELD_LABEL) as Field[]).map((f) => ({ value: f, label: `${i + 1}: ${FIELD_LABEL[f]}` }))}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex cursor-pointer items-center gap-2 text-fg-2">
              <input type="checkbox" checked={create} onChange={(e) => setCreate(e.target.checked)} className="size-4 accent-[#8b6cff]" />
              Создавать недостающие отделы и должности
            </label>
            <span className="text-muted">Если не указано:</span>
            <Select className="h-8 w-40 text-xs" value={defDept} onChange={setDefDept} options={config.departments.map((d) => ({ value: d.id, label: d.name }))} />
            <Select className="h-8 w-48 text-xs" value={defPos} onChange={setDefPos} options={config.positions.map((p) => ({ value: p.id, label: p.name }))} />
          </div>
          <div className="max-h-[300px] overflow-auto rounded-xl border border-white/[0.07]">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-ink-800">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 font-medium" />
                  <th className="px-2 py-2 font-medium">Имя</th>
                  <th className="px-2 py-2 font-medium">Паспорт</th>
                  <th className="px-2 py-2 font-medium">Отдел</th>
                  <th className="px-2 py-2 font-medium">Должность</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.line} className={cn("border-t border-white/[0.04]", r.problem && "opacity-50")}>
                    <td className="px-3 py-1.5">
                      {r.problem ? (
                        <span title={r.problem}>
                          <AlertTriangle size={15} className="text-warn" />
                        </span>
                      ) : (
                        <CheckCircle2 size={15} className="text-good" />
                      )}
                    </td>
                    <td className="px-2">
                      {r.name || <span className="text-bad">—</span>}
                      {r.problem && <span className="ml-2 text-[11px] text-warn">{r.problem}</span>}
                    </td>
                    <td className="px-2 font-mono text-fg-2">{r.passport || <span className="text-faint">—</span>}</td>
                    <td className="px-2">
                      {r.deptName}
                      {r.deptNew && <PlusCircle size={12} className="ml-1 inline text-accent-2" />}
                    </td>
                    <td className="px-2">
                      {r.posName}
                      {r.posNew && <PlusCircle size={12} className="ml-1 inline text-accent-2" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge color="#34d399">готово к импорту: {result.plan?.employees.length ?? 0}</Badge>
            {result.rows.some((r) => r.problem) && <Badge color="#fbbf24">пропущено: {result.rows.filter((r) => r.problem).length}</Badge>}
            {!!result.plan?.newDepartments.length && <Badge color="#22d3ee">новых отделов: {result.plan.newDepartments.length}</Badge>}
            {!!result.plan?.newPositions.length && <Badge color="#22d3ee">новых должностей: {result.plan.newPositions.length}</Badge>}
          </div>
        </>
      )}
    </div>
  );
}

/** Применить план к магазину. */
export function applyImportPlan(plan: ImportPlan, store: {
  updateConfig: (fn: (c: OrgConfig) => void) => void;
  importEmployees: (list: Omit<Employee, "id">[]) => number;
}): number {
  if (plan.newDepartments.length || plan.newPositions.length)
    store.updateConfig((c) => {
      c.departments.push(...plan.newDepartments);
      c.positions.push(...plan.newPositions);
    });
  return store.importEmployees(plan.employees);
}
