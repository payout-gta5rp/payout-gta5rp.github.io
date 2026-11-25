import { ArrowLeft, ClipboardPaste, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { EmployeeImport, applyImportPlan, type ImportPlan } from "@/components/EmployeeImport";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { WeekBars } from "@/components/charts";
import { Avatar, Badge, Button, Card, Dot, Empty, Input, Modal, PageHeader, Segmented, Stat } from "@/components/ui";
import { useArchiveCalcs, useCurrentCalc } from "@/hooks";
import { cn, money, period, periodShort } from "@/lib/format";
import { go } from "@/lib/router";
import { useStore } from "@/store";
import { useUi } from "@/uiStore";

export function EmployeesPage({ id }: { id?: string }) {
  if (id) return <EmployeeCard id={id} />;
  return <EmployeesList />;
}

function useHistory() {
  const archive = useArchiveCalcs();
  return useMemo(() => {
    const m = new Map<string, { weeks: number; total: number }>();
    for (const { calc } of archive)
      for (const l of Object.values(calc.lines)) {
        if (l.gross <= 0) continue;
        const v = m.get(l.employeeId) ?? { weeks: 0, total: 0 };
        v.weeks++;
        v.total += l.gross;
        m.set(l.employeeId, v);
      }
    return m;
  }, [archive]);
}

function EmployeesList() {
  const config = useStore((s) => s.config);
  const employees = useStore((s) => s.employees);
  const setUi = useUi((s) => s.set);
  const calc = useCurrentCalc();
  const hist = useHistory();
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [del, setDel] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const deptById = new Map(config.departments.map((d) => [d.id, d]));
  const posIdx = new Map(config.positions.map((p, i) => [p.id, i]));
  const dIdx = new Map(config.departments.map((d, i) => [d.id, i]));

  const list = employees
    .filter((e) => dept === "all" || e.deptId === dept)
    .filter((e) => !q.trim() || (e.name + " " + e.passport).toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (dIdx.get(a.deptId) ?? 0) - (dIdx.get(b.deptId) ?? 0) || (posIdx.get(a.positionId) ?? 0) - (posIdx.get(b.positionId) ?? 0) || a.name.localeCompare(b.name));

  const noPassport = employees.filter((e) => !e.passport).length;

  return (
    <div>
      <PageHeader
        title="Сотрудники"
        subtitle={`${employees.length} в реестре · ${employees.filter((e) => e.active).length} участвуют в премии${noPassport ? ` · ${noPassport} без паспорта` : ""}`}
        actions={
          <>
            <Button onClick={() => setImporting(true)}>
              <ClipboardPaste size={16} /> Импорт из таблицы
            </Button>
            <Button variant="primary" onClick={() => setUi({ employeeForm: {} })}>
              <Plus size={16} /> Добавить
            </Button>
          </>
        }
      />
      <Modal
        open={importing}
        onClose={() => setImporting(false)}
        width={860}
        title="Импорт сотрудников"
        footer={
          <>
            <Button variant="ghost" onClick={() => setImporting(false)}>
              Отмена
            </Button>
            <Button
              variant="primary"
              disabled={!plan}
              onClick={() => {
                const n = applyImportPlan(plan!, useStore.getState());
                setImporting(false);
                setPlan(null);
                toast.success(`Добавлено сотрудников: ${n}`);
              }}
            >
              Импортировать {plan ? plan.employees.length : ""}
            </Button>
          </>
        }
      >
        {importing && <EmployeeImport config={config} existing={employees} onPlan={setPlan} />}
      </Modal>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input placeholder="Имя или паспорт" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <div className="max-w-full overflow-x-auto">
          <Segmented
            value={dept}
            onChange={setDept}
            options={[{ value: "all", label: "Все" }, ...config.departments.map((d) => ({ value: d.id, label: d.name }))]}
          />
        </div>
      </div>
      <Card className="overflow-x-auto">
        {!list.length ? (
          <Empty icon={<Users size={24} />} title="Никого нет" text="Добавьте сотрудников или измените фильтр." />
        ) : (
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-medium">Сотрудник</th>
                <th className="px-2 py-3 font-medium">Отдел</th>
                <th className="px-2 py-3 font-medium">Паспорт</th>
                <th className="px-2 py-3 font-medium">Премия</th>
                <th className="px-2 py-3 text-right font-medium">Эта неделя</th>
                <th className="px-2 py-3 text-right font-medium">За всё время</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {list.map((e) => {
                const d = deptById.get(e.deptId);
                const pos = config.positions.find((p) => p.id === e.positionId);
                const h = hist.get(e.id);
                return (
                  <tr key={e.id} className="group border-t border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5">
                      <button onClick={() => go({ name: "employees", id: e.id })} className="flex cursor-pointer items-center gap-3 text-left">
                        <Avatar name={e.name} color={d?.color} size={32} />
                        <div>
                          <div className="font-medium hover:underline decoration-white/30 underline-offset-2">{e.name}</div>
                          <div className="text-[11px] text-muted">{pos?.name}</div>
                        </div>
                      </button>
                    </td>
                    <td className="px-2">{d && <Badge color={d.color}>{d.name}</Badge>}</td>
                    <td className="px-2 font-mono text-fg-2">{e.passport || <span className="text-bad">—</span>}</td>
                    <td className="px-2">
                      <button
                        onClick={() => useStore.getState().updateEmployee(e.id, { active: !e.active })}
                        className={cn(
                          "relative h-5 w-9 cursor-pointer rounded-full transition",
                          e.active ? "bg-gradient-to-r from-accent to-accent-2" : "bg-white/10",
                        )}
                        title={e.active ? "Участвует в премии" : "Не участвует"}
                      >
                        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", e.active ? "left-[18px]" : "left-0.5")} />
                      </button>
                    </td>
                    <td className="num px-2 text-right font-mono">{money(calc.lines[e.id]?.gross ?? 0)}</td>
                    <td className="num px-2 text-right font-mono text-fg-2">
                      {money(h?.total ?? 0)}
                      <span className="ml-1.5 text-[11px] text-faint">{h?.weeks ?? 0} нед</span>
                    </td>
                    <td className="px-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                        <button onClick={() => setUi({ employeeForm: { id: e.id } })} className="cursor-pointer rounded-lg p-1.5 text-muted hover:bg-white/[0.06] hover:text-fg">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => setDel(e.id)} className="cursor-pointer rounded-lg p-1.5 text-muted hover:bg-bad/10 hover:text-bad">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      <Modal
        open={!!del}
        onClose={() => setDel(null)}
        title="Удалить сотрудника?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDel(null)}>
              Отмена
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                useStore.getState().removeEmployee(del!);
                setDel(null);
                toast.success("Сотрудник удалён");
              }}
            >
              Удалить
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {employees.find((e) => e.id === del)?.name} исчезнет из реестра и текущей недели. Закрытые недели в архиве не изменятся.
          Если человек просто временно не получает премию — лучше выключите переключатель «Премия».
        </p>
      </Modal>
    </div>
  );
}

function EmployeeCard({ id }: { id: string }) {
  const emp = useStore((s) => s.employees.find((e) => e.id === id));
  const config = useStore((s) => s.config);
  const start = useStore((s) => s.current.start);
  const setUi = useUi((s) => s.set);
  const archive = useArchiveCalcs();
  const calc = useCurrentCalc();

  const history = useMemo(
    () =>
      archive
        .map(({ week, calc }) => ({ week, line: calc.lines[id] }))
        .filter((h) => h.week.members.some((m) => m.id === id)),
    [archive, id],
  );

  if (!emp)
    return (
      <Card>
        <Empty icon={<Users size={24} />} title="Сотрудник не найден" action={<Button onClick={() => go({ name: "employees" })}>К списку</Button>} />
      </Card>
    );

  const d = config.departments.find((x) => x.id === emp.deptId);
  const pos = config.positions.find((p) => p.id === emp.positionId);
  const paid = history.filter((h) => (h.line?.gross ?? 0) > 0);
  const total = paid.reduce((s, h) => s + h.line!.gross, 0);
  const max = Math.max(0, ...paid.map((h) => h.line!.gross));
  const cur = config.rules.currency;

  return (
    <div>
      <button onClick={() => go({ name: "employees" })} className="mb-3 inline-flex cursor-pointer items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft size={15} /> Сотрудники
      </button>
      <Card className="relative mb-5 overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full blur-3xl" style={{ background: (d?.color ?? "#8b6cff") + "33" }} />
        <div className="relative flex flex-wrap items-center gap-5">
          <Avatar name={emp.name} color={d?.color} size={64} />
          <div className="flex-1">
            <div className="text-[26px] font-semibold tracking-tight">{emp.name}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {d && <Badge color={d.color}>{d.name}</Badge>}
              <Badge>{pos?.name}</Badge>
              {pos && pos.multiplier !== 100 && <Badge color="#22d3ee">множитель ×{pos.multiplier / 100}</Badge>}
              <span className="font-mono text-xs text-muted">паспорт {emp.passport || "—"}</span>
              {!emp.active && <Badge color="#fb7185">не в премии</Badge>}
            </div>
          </div>
          <Button onClick={() => setUi({ employeeForm: { id } })}>
            <Pencil size={15} /> Изменить
          </Button>
        </div>
      </Card>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Эта неделя" value={money(calc.lines[id]?.gross ?? 0)} sub={`${calc.lines[id]?.points ?? 0} баллов`} accent="#8b6cff" />
        <Stat label="Получено всего" value={money(total)} sub={cur} accent="#22d3ee" />
        <Stat label="Недель с премией" value={paid.length} sub={`из ${history.length} в составе`} accent="#34d399" />
        <Stat label="Средняя / максимум" value={money(paid.length ? total / paid.length : 0)} sub={`макс. ${money(max)}`} accent="#fbbf24" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <div className="mb-5 font-semibold">Начисления по неделям</div>
          <WeekBars
            currency={cur}
            data={[
              ...history.map((h) => ({
                key: h.week.id,
                label: periodShort(h.week.start),
                value: h.line?.gross ?? 0,
                sub: h.line ? `${h.line.points} баллов` : undefined,
              })),
              { key: "current", label: periodShort(start), value: calc.lines[id]?.gross ?? 0, current: true },
            ]}
            onSelect={(k) => go(k === "current" ? { name: "week" } : { name: "archive", id: k })}
          />
        </Card>
        <Card className="p-5">
          <div className="mb-3 font-semibold">История выплат</div>
          <div className="max-h-[300px] space-y-0.5 overflow-auto">
            {[...history].reverse().map((h) => (
              <button
                key={h.week.id}
                onClick={() => go({ name: "archive", id: h.week.id })}
                className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-white/[0.04]"
              >
                <span className="flex items-center gap-2 text-fg-2">
                  <Dot color={h.line?.paid ? "#34d399" : h.line?.gross ? "#fb7185" : "#4c5368"} className="size-1.5" />
                  {period(h.week.start)}
                </span>
                <span className="num font-mono">{h.line?.gross ? money(h.line.gross) : <span className="text-faint">—</span>}</span>
              </button>
            ))}
            {!history.length && <div className="py-8 text-center text-sm text-muted">В архиве пока нет недель с этим сотрудником</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
