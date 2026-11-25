import { AlertTriangle, CalendarDays, Crown, Eye, EyeOff, Keyboard, Plus, Search, Sigma, Sparkles, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmployeeDrawer } from "@/components/EmployeeDrawer";
import { Avatar, Badge, Button, Card, Dot, Input, Kbd, PageHeader, Segmented, Stat } from "@/components/ui";
import { groupByDept, useCurrentCalc } from "@/hooks";
import { cn, money, period, plural } from "@/lib/format";
import { useStore } from "@/store";
import { useUi } from "@/uiStore";
import type { ActionDef, CalcWarning, Department, Employee } from "@/engine/types";

type ColKey = string; // action id | "__share" | "__manual"
const SHARE = "__share";
const MANUAL = "__manual";

export function WeekPage() {
  const config = useStore((s) => s.config);
  const employees = useStore((s) => s.employees);
  const entries = useStore((s) => s.current.entries);
  const start = useStore((s) => s.current.start);
  const st = useStore.getState();
  const calc = useCurrentCalc();
  const setUi = useUi((s) => s.set);

  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [onlyFilled, setOnlyFilled] = useState(false);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [sel, setSel] = useState<{ row: string; col: ColKey } | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // ── Строки ──
  const groups = useMemo(() => {
    const query = q.trim().toLowerCase();
    return groupByDept(
      config.departments,
      employees.filter((e) => e.active),
      config.positions.map((p) => p.id),
    )
      .filter((g) => deptFilter === "all" || g.dept.id === deptFilter)
      .map((g) => ({
        ...g,
        employees: query
          ? g.employees.filter((e) => (e.name + " " + e.passport).toLowerCase().includes(query))
          : g.employees,
      }))
      .filter((g) => !query || g.employees.length);
  }, [config, employees, deptFilter, q]);

  const rows = useMemo(() => groups.flatMap((g) => g.employees), [groups]);
  const deptOf = useMemo(() => new Map(config.departments.map((d) => [d.id, d])), [config.departments]);

  // ── Столбцы ──
  const modes = new Set(groups.map((g) => g.dept.mode));
  const actions = useMemo(() => {
    let list = config.actions.filter((a) => !a.archived);
    if (!modes.has("points")) return [] as ActionDef[];
    if (onlyFilled) list = list.filter((a) => rows.some((r) => (entries[r.id]?.counts[a.id] ?? 0) > 0));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.actions, onlyFilled, rows, entries, modes.has("points")]);

  const cols: ColKey[] = useMemo(() => {
    const c: ColKey[] = actions.map((a) => a.id);
    if (modes.has("budgetShare")) c.push(SHARE);
    if (modes.has("manual")) c.push(MANUAL);
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, modes.has("budgetShare"), modes.has("manual")]);

  const actionById = useMemo(() => new Map(config.actions.map((a) => [a.id, a])), [config.actions]);

  const enabled = useCallback(
    (emp: Employee, col: ColKey) => {
      const d = deptOf.get(emp.deptId);
      if (!d) return false;
      if (col === SHARE) return d.mode === "budgetShare";
      if (col === MANUAL) return d.mode === "manual";
      if (d.mode !== "points") return false;
      const a = actionById.get(col);
      return !!a && (!a.deptIds?.length || a.deptIds.includes(d.id));
    },
    [deptOf, actionById],
  );

  const valueOf = (emp: Employee, col: ColKey): number => {
    const e = entries[emp.id];
    if (col === SHARE) return e?.share ?? 0;
    if (col === MANUAL) return e?.manual ?? 0;
    return e?.counts[col] ?? 0;
  };

  const commit = (empId: string, col: ColKey, raw: string) => {
    const n = raw.trim() === "" ? 0 : Number(raw.replace(",", ".").replace(/\s/g, ""));
    if (Number.isNaN(n)) return;
    if (col === SHARE) st.setShare(empId, n || undefined);
    else if (col === MANUAL) st.setManual(empId, n || undefined);
    else st.setCount(empId, col, n);
  };

  // ── Навигация ──
  const move = useCallback(
    (dr: number, dc: number) => {
      setSel((cur) => {
        if (!rows.length || !cols.length) return cur;
        if (!cur) {
          for (const r of rows) for (const c of cols) if (enabled(r, c)) return { row: r.id, col: c };
          return cur;
        }
        const ri = rows.findIndex((r) => r.id === cur.row);
        const ci = cols.indexOf(cur.col);
        if (ri < 0 || ci < 0) return cur;
        if (dc) {
          for (let i = ci + dc; i >= 0 && i < cols.length; i += dc) if (enabled(rows[ri], cols[i])) return { row: cur.row, col: cols[i] };
          return cur;
        }
        for (let i = ri + dr; i >= 0 && i < rows.length; i += dr) {
          if (enabled(rows[i], cols[ci])) return { row: rows[i].id, col: cols[ci] };
        }
        return cur;
      });
    },
    [rows, cols, enabled],
  );

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (drawer || useUi.getState().palette || useUi.getState().closeWeek || useUi.getState().employeeForm) return;
      const t = e.target as HTMLElement;
      if (t?.closest?.("input, textarea, select")) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!sel) {
        if (e.key.startsWith("Arrow")) {
          e.preventDefault();
          move(0, 0);
        }
        return;
      }
      const emp = rows.find((r) => r.id === sel.row);
      if (!emp) return;
      const k = e.key;
      if (k === "ArrowDown") (e.preventDefault(), move(1, 0));
      else if (k === "ArrowUp") (e.preventDefault(), move(-1, 0));
      else if (k === "ArrowRight") (e.preventDefault(), move(0, 1));
      else if (k === "ArrowLeft") (e.preventDefault(), move(0, -1));
      else if (k === "Tab") (e.preventDefault(), move(0, e.shiftKey ? -1 : 1));
      else if (k === "Enter" || k === "F2") (e.preventDefault(), setEdit(String(valueOf(emp, sel.col) || "")));
      else if (/^[0-9]$/.test(k)) (e.preventDefault(), setEdit(k));
      else if (k === "Backspace" || k === "Delete") (e.preventDefault(), commit(emp.id, sel.col, "0"));
      else if (k === "+" || k === "=" || k === " " || e.code === "NumpadAdd") (e.preventDefault(), commit(emp.id, sel.col, String(valueOf(emp, sel.col) + 1)));
      else if (k === "-" || k === "_") (e.preventDefault(), commit(emp.id, sel.col, String(Math.max(0, valueOf(emp, sel.col) - 1))));
      else if (k === "Escape") setSel(null);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  // ── Группы столбцов-действий ──
  const actionGroups = useMemo(() => {
    const out: { name: string; color: string; actions: ActionDef[] }[] = [];
    for (const a of actions) {
      let g = out[out.length - 1];
      if (!g || g.name !== a.group) {
        const d = config.departments.find((x) => a.group.toLowerCase().startsWith(x.name.toLowerCase()));
        g = { name: a.group, color: d?.color ?? "#8b6cff", actions: [] };
        out.push(g);
      }
      g.actions.push(a);
    }
    return out;
  }, [actions, config.departments]);

  const colTotals = useMemo(() => {
    const m = new Map<ColKey, number>();
    for (const c of cols) m.set(c, rows.reduce((s, r) => s + (enabled(r, c) ? valueOf(r, c) : 0), 0));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, rows, entries]);

  const leader = calc.leader ? employees.find((e) => e.id === calc.leader!.employeeId) : null;
  const hasPoints = config.departments.some((d) => d.mode === "points");
  // Без баллов лидер — по сумме, без учёта фиксированных ставок
  const topLine = Object.values(calc.lines)
    .filter((l) => config.departments.find((d) => d.id === l.deptId)?.mode !== "fixed" && l.gross > 0)
    .sort((a, b) => b.gross - a.gross)[0];
  const topEarner = topLine ? employees.find((e) => e.id === topLine.employeeId) : null;
  const withPoints = Object.values(calc.lines).filter((l) => l.gross > 0).length;
  const activeCount = employees.filter((e) => e.active).length;
  const cur = config.rules.currency;
  const selAction = sel && actionById.get(sel.col);

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            Ввод недели
            <span className="text-gradient text-[22px]">{period(start)}</span>
          </span>
        }
        subtitle="Выберите ячейку и вводите числа с клавиатуры — баллы и суммы пересчитываются мгновенно"
        actions={
          <>
            <label className="relative">
              <CalendarDays size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="date"
                value={start}
                onChange={(e) => e.target.value && st.setWeekStart(e.target.value)}
                className="h-9 cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.04] pl-9 pr-3 text-sm text-fg outline-none [color-scheme:dark] focus:border-accent/60"
                title="Начало недели"
              />
            </label>
            <Button onClick={() => setUi({ employeeForm: { deptId: deptFilter !== "all" ? deptFilter : undefined } })}>
              <Plus size={16} /> Сотрудник
            </Button>
            <Button variant="primary" onClick={() => setUi({ closeWeek: true })}>
              Закрыть неделю
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="В премии"
          icon={<Users size={14} />}
          value={
            <>
              {withPoints}
              <span className="text-base text-muted"> / {activeCount}</span>
            </>
          }
          sub={`${plural(withPoints, "сотрудник", "сотрудника", "сотрудников")} с начислением`}
          accent="#8b6cff"
        />
        {hasPoints ? (
          <Stat label="Баллы" icon={<Sigma size={14} />} value={calc.totals.points.toLocaleString("ru-RU")} sub={`цена балла ${money(config.rules.pointPrice, cur)}`} accent="#22d3ee" />
        ) : (
          <Stat
            label="Бюджет"
            icon={<Sigma size={14} />}
            value={money(config.rules.budget)}
            sub={
              config.rules.budget
                ? `распределено ${Math.round((calc.totals.gross / config.rules.budget) * 100)}% · остаток ${money(config.rules.budget - calc.totals.gross)}`
                : "не задан"
            }
            accent="#22d3ee"
          />
        )}
        <Stat label="Начислено" icon={<Sparkles size={14} />} value={money(calc.totals.gross)} sub={`к выдаче ${money(calc.totals.net, cur)}`} accent="#34d399" />
        <Stat
          label="Лидер недели"
          icon={<Crown size={14} />}
          value={<span className="text-[18px]">{(hasPoints ? leader : topEarner)?.name ?? "—"}</span>}
          sub={hasPoints ? (calc.leader ? `${calc.leader.points} баллов` : "пока никого") : topLine ? money(topLine.gross, cur) : "пока никого"}
          accent="#fbbf24"
        />
      </div>

      {calc.warnings.length > 0 && <Warnings items={calc.warnings} onOpen={setDrawer} />}

      {/* Панель фильтров */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input placeholder="Имя или паспорт" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <div className="max-w-full overflow-x-auto">
          <Segmented
            value={deptFilter}
            onChange={setDeptFilter}
            options={[
              { value: "all", label: "Все отделы" },
              ...config.departments.map((d) => ({
                value: d.id,
                label: (
                  <span className="flex items-center gap-1.5">
                    <Dot color={d.color} className="size-1.5" />
                    {d.name}
                  </span>
                ),
              })),
            ]}
          />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setOnlyFilled((v) => !v)}>
            {onlyFilled ? <Eye size={15} /> : <EyeOff size={15} />}
            {onlyFilled ? "Все действия" : "Только заполненные"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowHelp((v) => !v)}>
            <Keyboard size={15} /> Клавиши
          </Button>
        </div>
      </div>

      {showHelp && (
        <Card className="mb-3 flex flex-wrap gap-x-6 gap-y-2 px-4 py-3 text-xs text-fg-2">
          <span><Kbd>←↑→↓</Kbd> перемещение</span>
          <span><Kbd>0–9</Kbd> ввод числа</span>
          <span><Kbd>Enter</Kbd> изменить / сохранить и вниз</span>
          <span><Kbd>Tab</Kbd> вправо</span>
          <span><Kbd>+</Kbd> <Kbd>Пробел</Kbd> +1</span>
          <span><Kbd>−</Kbd> −1</span>
          <span><Kbd>Del</Kbd> очистить</span>
          <span><Kbd>Ctrl Z</Kbd> отменить</span>
          <span><Kbd>Esc</Kbd> снять выделение</span>
        </Card>
      )}

      {/* Подсказка выбранного действия */}
      <div className="mb-2 h-5 text-xs text-muted">
        {sel && selAction ? (
          <span>
            <span className="font-mono text-faint">{selAction.code}</span> · {selAction.name} ·{" "}
            <span className="text-accent-2">{selAction.points} {plural(selAction.points, "балл", "балла", "баллов")}</span> за единицу
          </span>
        ) : sel?.col === SHARE ? (
          <span>% вклада сотрудника внутри отдела. Сумма по отделу должна быть 100%.</span>
        ) : null}
      </div>

      <Card className="overflow-hidden">
        <div className="max-h-[calc(100vh-180px)] overflow-auto" onMouseDown={(e) => e.target === e.currentTarget && setSel(null)}>
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-20">
              {actions.length > 0 && (
                <tr>
                  <th className="sticky left-0 z-30 bg-ink-850" />
                  {actionGroups.map((g) => (
                    <th
                      key={g.name}
                      colSpan={g.actions.length}
                      className="border-b border-white/[0.06] bg-ink-850 px-2 pb-1.5 pt-2.5 text-left"
                    >
                      <span
                        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider"
                        style={{ color: g.color, background: g.color + "18" }}
                      >
                        {g.name}
                      </span>
                    </th>
                  ))}
                  {cols.length > actions.length && <th colSpan={cols.length - actions.length} className="bg-ink-850" />}
                  <th className="sticky right-0 z-30 bg-ink-850" />
                </tr>
              )}
              <tr>
                <th className="sticky left-0 z-30 min-w-[260px] border-b border-r border-white/[0.07] bg-ink-850 px-4 py-2 text-left text-xs font-medium text-muted">
                  Сотрудник
                </th>
                {cols.map((c) => {
                  const a = actionById.get(c);
                  const active = sel?.col === c;
                  return (
                    <th
                      key={c}
                      title={a ? `${a.code} · ${a.name} · ${a.points} б.` : undefined}
                      className={cn(
                        "h-[58px] w-[66px] min-w-[66px] border-b border-white/[0.07] bg-ink-850 px-1 align-bottom pb-2 transition-colors",
                        active && "bg-accent/10",
                      )}
                    >
                      <div className={cn("text-[11px] font-medium leading-tight", active ? "text-fg" : "text-fg-2")}>
                        {a ? a.short : c === SHARE ? "% вклада" : "Сумма"}
                      </div>
                      {a && <div className="mt-1 font-mono text-[10px] text-accent-2/80">×{a.points}</div>}
                    </th>
                  );
                })}
                <th className="sticky right-0 z-30 min-w-[210px] border-b border-l border-white/[0.07] bg-ink-850 px-4 py-2 text-right text-xs font-medium text-muted">
                  <div className="flex justify-end gap-6">
                    {modes.has("points") && <span className="w-12">Баллы</span>}
                    <span className="w-24">Начислено</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <DeptBlock
                  key={g.dept.id}
                  dept={g.dept}
                  employees={g.employees}
                  cols={cols}
                  calc={calc}
                  currency={cur}
                  showPoints={modes.has("points")}
                  positions={config.positions}
                  sel={sel}
                  edit={edit}
                  enabled={enabled}
                  valueOf={valueOf}
                  maxOf={(c) => actionById.get(c)?.maxPerWeek ?? null}
                  onSelect={(row, col) => {
                    setSel({ row, col });
                    setEdit(null);
                  }}
                  onEdit={(row, col) => {
                    setSel({ row, col });
                    const emp = rows.find((r) => r.id === row)!;
                    setEdit(String(valueOf(emp, col) || ""));
                  }}
                  onCommit={(raw, dir) => {
                    if (!sel) return;
                    commit(sel.row, sel.col, raw);
                    setEdit(null);
                    if (dir === "down") move(1, 0);
                    else if (dir === "right") move(0, 1);
                    else if (dir === "left") move(0, -1);
                    else if (dir === "up") move(-1, 0);
                  }}
                  onCancel={() => setEdit(null)}
                  onOpen={setDrawer}
                  onAdd={() => setUi({ employeeForm: { deptId: g.dept.id } })}
                />
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={cols.length + 2} className="py-16 text-center text-sm text-muted">
                    {employees.length ? "Никого не найдено" : "Добавьте сотрудников, чтобы начать ввод"}
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="sticky bottom-0 z-20">
                <tr>
                  <td className="sticky left-0 z-30 border-r border-t border-white/[0.07] bg-ink-850 px-4 py-2.5 text-xs font-medium text-muted">
                    Итого по столбцам
                  </td>
                  {cols.map((c) => (
                    <td key={c} className="num border-t border-white/[0.07] bg-ink-850 text-center font-mono text-xs text-fg-2">
                      {colTotals.get(c) || <span className="text-faint">·</span>}
                    </td>
                  ))}
                  <td className="sticky right-0 z-30 border-l border-t border-white/[0.07] bg-ink-850 px-4 py-2.5">
                    <div className="num flex justify-end gap-6 font-mono text-[13px] font-semibold">
                      {modes.has("points") && <span className="w-12 text-right">{calc.totals.points}</span>}
                      <span className="w-24 text-right">{money(calc.totals.gross)}</span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      <EmployeeDrawer id={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

type Dir = "down" | "up" | "right" | "left" | "stay";

function Warnings({ items, onOpen }: { items: CalcWarning[]; onOpen: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 3);
  return (
    <Card className="mb-5 border-warn/20 bg-warn/[0.04] px-4 py-3">
      <div className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-warn">
        <AlertTriangle size={15} /> Проверьте перед выплатой · {items.length}
      </div>
      <div className="space-y-0.5">
        {shown.map((w, i) => (
          <button
            key={i}
            disabled={!w.employeeId}
            onClick={() => w.employeeId && onOpen(w.employeeId)}
            className="block w-full cursor-pointer rounded-md px-1 py-0.5 text-left text-[13px] text-fg-2 enabled:hover:bg-white/[0.04] disabled:cursor-default"
          >
            {w.text}
          </button>
        ))}
      </div>
      {items.length > 3 && (
        <button onClick={() => setAll((v) => !v)} className="mt-1 cursor-pointer px-1 text-xs text-muted hover:text-fg">
          {all ? "Свернуть" : `Показать все (${items.length})`}
        </button>
      )}
    </Card>
  );
}

function DeptBlock(props: {
  dept: Department;
  employees: Employee[];
  cols: ColKey[];
  calc: ReturnType<typeof useCurrentCalc>;
  currency: string;
  showPoints: boolean;
  positions: { id: string; name: string; multiplier: number }[];
  sel: { row: string; col: ColKey } | null;
  edit: string | null;
  enabled: (e: Employee, c: ColKey) => boolean;
  valueOf: (e: Employee, c: ColKey) => number;
  maxOf: (c: ColKey) => number | null;
  onSelect: (row: string, col: ColKey) => void;
  onEdit: (row: string, col: ColKey) => void;
  onCommit: (raw: string, dir: Dir) => void;
  onCancel: () => void;
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  const { dept, employees, cols, calc, sel } = props;
  const dt = calc.depts[dept.id];
  const shareWarn = dept.mode === "budgetShare" && dt?.shareSum != null && Math.abs(dt.shareSum - 100) > 0.5;
  return (
    <>
      <tr>
        <td className="sticky left-0 z-10 border-b border-white/[0.05] bg-ink-900/95 px-4 pb-2 pt-4 backdrop-blur" colSpan={1}>
          <div className="flex items-center gap-2.5">
            <Dot color={dept.color} />
            <span className="text-[13px] font-semibold tracking-wide">{dept.name}</span>
            <span className="text-xs text-muted">{employees.length}</span>
            {dept.mode === "budgetShare" && (
              <Badge color={shareWarn ? "#fbbf24" : "#34d399"}>
                {Math.round((dt?.shareSum ?? 0) * 10) / 10}% · бюджет {money(dt?.budget ?? 0)}
              </Badge>
            )}
            {shareWarn && (dt?.shareSum ?? 0) > 0 && (
              <button
                onClick={() => useStore.getState().normalizeDeptShares(dept.id)}
                title="Пропорционально растянуть % вклада до 100%"
                className="cursor-pointer rounded-md bg-warn/10 px-2 py-0.5 text-[11px] font-medium text-warn hover:bg-warn/20"
              >
                → до 100%
              </button>
            )}
            {dept.mode === "fixed" && <Badge>ставки</Badge>}
            <button
              onClick={props.onAdd}
              className="ml-1 grid size-6 cursor-pointer place-items-center rounded-md text-muted opacity-60 hover:bg-white/[0.06] hover:text-fg hover:opacity-100"
              title="Добавить сотрудника в отдел"
            >
              <Plus size={14} />
            </button>
          </div>
        </td>
        <td colSpan={cols.length} className="border-b border-white/[0.05] bg-ink-900/40" />
        <td className="sticky right-0 z-10 border-b border-l border-white/[0.05] bg-ink-900/95 px-4 pb-2 pt-4 backdrop-blur">
          <div className="num flex justify-end gap-6 font-mono text-xs text-muted">
            {props.showPoints && <span className="w-12 text-right">{dt?.points ?? 0}</span>}
            <span className="w-24 text-right">{money(dt?.gross ?? 0)}</span>
          </div>
        </td>
      </tr>
      {employees.map((e) => {
        const line = calc.lines[e.id];
        const rowSel = sel?.row === e.id;
        const pos = props.positions.find((p) => p.id === e.positionId);
        return (
          <tr key={e.id} className="group">
            <td
              className={cn(
                "sticky left-0 z-10 border-b border-r border-white/[0.05] bg-ink-900 px-3 py-1.5 transition-colors group-hover:bg-ink-850",
                rowSel && "!bg-ink-800",
              )}
            >
              <button onClick={() => props.onOpen(e.id)} className="flex w-full cursor-pointer items-center gap-2.5 text-left">
                <Avatar name={e.name} color={dept.color} size={28} />
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-medium leading-tight hover:underline decoration-white/30 underline-offset-2">{e.name}</div>
                  <div className="truncate text-[11px] text-muted">
                    {pos?.name}
                    {pos && pos.multiplier !== 100 && <span className="ml-1 text-accent-2">×{pos.multiplier / 100}</span>}
                  </div>
                </div>
              </button>
            </td>
            {cols.map((c) => {
              const en = props.enabled(e, c);
              const v = props.valueOf(e, c);
              const isSel = rowSel && sel?.col === c;
              const colSel = sel?.col === c;
              const max = props.maxOf(c);
              const over = max != null && v > max;
              return (
                <td
                  key={c}
                  onMouseDown={(ev) => {
                    if (!en) return;
                    ev.preventDefault();
                    props.onSelect(e.id, c);
                  }}
                  onDoubleClick={() => en && props.onEdit(e.id, c)}
                  className={cn(
                    "relative h-11 border-b border-white/[0.04] p-0 text-center transition-colors",
                    en ? "cursor-cell" : "bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(255_255_255/0.015)_6px_12px)]",
                    (rowSel || colSel) && en && "bg-white/[0.025]",
                    "group-hover:bg-white/[0.02]",
                  )}
                >
                  {isSel && props.edit != null ? (
                    <CellEditor initial={props.edit} onCommit={props.onCommit} onCancel={props.onCancel} />
                  ) : (
                    <span
                      className={cn(
                        "num absolute inset-1 grid place-items-center rounded-lg font-mono text-[13px] transition-all",
                        v ? "text-fg" : "text-transparent",
                        v > 0 && "bg-accent/[0.09] text-[#d9d0ff]",
                        over && "!bg-warn/15 !text-warn ring-1 ring-warn/50",
                        isSel && "!bg-accent/20 ring-2 ring-accent shadow-glow text-fg",
                      )}
                      title={over ? `Больше обычного максимума (${max})` : undefined}
                    >
                      {en ? (c === SHARE && v ? v + "%" : v || "·") : ""}
                    </span>
                  )}
                </td>
              );
            })}
            <td
              className={cn(
                "sticky right-0 z-10 border-b border-l border-white/[0.05] bg-ink-900 px-4 transition-colors group-hover:bg-ink-850",
                rowSel && "!bg-ink-800",
              )}
            >
              <button onClick={() => props.onOpen(e.id)} className="num flex w-full cursor-pointer items-center justify-end gap-6 font-mono">
                {props.showPoints && (
                  <span className={cn("w-12 text-right text-[13px]", line?.points ? "text-fg-2" : "text-faint")}>{line?.points ?? 0}</span>
                )}
                <span className={cn("flex w-24 flex-col items-end text-[13.5px] font-semibold leading-tight", line?.gross ? "text-fg" : "text-faint")}>
                  {money(line?.gross ?? 0)}
                  {line?.capped && (
                    <span className="font-sans text-[9px] font-semibold uppercase tracking-wider text-warn">лимит</span>
                  )}
                </span>
              </button>
            </td>
          </tr>
        );
      })}
    </>
  );
}

function CellEditor({ initial, onCommit, onCancel }: { initial: string; onCommit: (raw: string, dir: Dir) => void; onCancel: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [v, setV] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, []);
  return (
    <input
      ref={ref}
      value={v}
      inputMode="decimal"
      onChange={(e) => setV(e.target.value.replace(/[^\d.,]/g, ""))}
      onBlur={() => onCommit(v, "stay")}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") (e.preventDefault(), onCommit(v, "down"));
        else if (e.key === "Tab") (e.preventDefault(), onCommit(v, e.shiftKey ? "left" : "right"));
        else if (e.key === "ArrowDown") (e.preventDefault(), onCommit(v, "down"));
        else if (e.key === "ArrowUp") (e.preventDefault(), onCommit(v, "up"));
        else if (e.key === "Escape") (e.preventDefault(), onCancel());
      }}
      className="num absolute inset-1 rounded-lg bg-ink-700 text-center font-mono text-[13px] text-fg outline-none ring-2 ring-accent-2 shadow-[0_0_0_4px_rgb(34_211_238/0.15)]"
    />
  );
}
