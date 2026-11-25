import { Check, CheckCheck, Copy, FileSpreadsheet, Percent, Search, Wallet, Clock } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmployeeDrawer } from "@/components/EmployeeDrawer";
import { Avatar, Button, Card, Dot, Empty, Input, PageHeader, Progress, Segmented, Stat } from "@/components/ui";
import { downloadCurrentReport } from "@/export/report";
import { groupByDept, useCurrentCalc } from "@/hooks";
import { cn, dmy, money, period } from "@/lib/format";
import { useStore } from "@/store";
import { useUi } from "@/uiStore";

export function PayoutsPage() {
  const config = useStore((s) => s.config);
  const employees = useStore((s) => s.employees);
  const entries = useStore((s) => s.current.entries);
  const start = useStore((s) => s.current.start);
  const st = useStore.getState();
  const calc = useCurrentCalc();
  const setUi = useUi((s) => s.set);
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [q, setQ] = useState("");
  const [drawer, setDrawer] = useState<string | null>(null);
  const cur = config.rules.currency;

  const groups = useMemo(() => {
    const query = q.trim().toLowerCase();
    return groupByDept(config.departments, employees, config.positions.map((p) => p.id))
      .map((g) => ({
        ...g,
        employees: g.employees.filter((e) => {
          const l = calc.lines[e.id];
          if (!l || l.gross <= 0) return false;
          if (filter === "paid" && !l.paid) return false;
          if (filter === "unpaid" && l.paid) return false;
          return !query || (e.name + " " + e.passport).toLowerCase().includes(query);
        }),
      }))
      .filter((g) => g.employees.length);
  }, [config, employees, calc, filter, q]);

  const t = calc.totals;
  const share = t.members ? t.paidCount / t.members : 0;

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            Ведомость <span className="text-gradient text-[22px]">{period(start)}</span>
          </span>
        }
        subtitle="Отмечайте выдачу одним кликом — дата проставится сама"
        actions={
          <>
            <Button
              onClick={() =>
                toast.promise(downloadCurrentReport(), { loading: "Готовлю отчёт…", success: "Отчёт .xlsx скачан", error: "Не получилось" })
              }
            >
              <FileSpreadsheet size={16} className="text-good" /> Отчёт .xlsx
            </Button>
            <Button variant="primary" onClick={() => setUi({ closeWeek: true })}>
              Закрыть неделю
            </Button>
          </>
        }
      />

      <Card className="relative mb-5 overflow-hidden p-5">
        <div className="pointer-events-none absolute -left-20 -top-24 size-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-xs font-medium text-muted">Выдано</div>
            <div className="num mt-1 text-[34px] font-semibold tracking-tight">
              {money(t.paidNet)} <span className="text-lg text-muted">/ {money(t.net, cur)}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="num text-[34px] font-semibold tracking-tight">
              {t.paidCount}
              <span className="text-lg text-muted"> из {t.members}</span>
            </div>
            <div className="text-xs text-muted">{Math.round(share * 100)}% сотрудников получили выплату</div>
          </div>
        </div>
        <Progress value={share} className="relative mt-4 h-2" />
      </Card>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Начислено" icon={<Wallet size={14} />} value={money(t.gross)} sub={cur} accent="#8b6cff" />
        <Stat label="Комиссия" icon={<Percent size={14} />} value={money(t.commission)} sub="за электронные переводы" accent="#22d3ee" />
        <Stat label="К выдаче" icon={<Check size={14} />} value={money(t.net)} sub="после комиссии" accent="#34d399" />
        <Stat label="Осталось выдать" icon={<Clock size={14} />} value={money(t.unpaidNet)} sub={`${t.members - t.paidCount} чел.`} accent="#fb7185" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input placeholder="Имя или паспорт" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Все" },
            { value: "unpaid", label: `Не выдано · ${t.members - t.paidCount}` },
            { value: "paid", label: `Выдано · ${t.paidCount}` },
          ]}
        />
      </div>

      {!groups.length ? (
        <Card>
          <Empty
            icon={<Wallet size={24} />}
            title={t.members ? "Здесь пусто" : "Пока нечего выдавать"}
            text={t.members ? "Под фильтр никто не подходит." : "Начисления появятся, как только на экране «Ввод недели» будут внесены действия."}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const unpaidIds = g.employees.filter((e) => !calc.lines[e.id]?.paid).map((e) => e.id);
            const dt = calc.depts[g.dept.id];
            return (
              <Card key={g.dept.id} className="overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-4 py-3">
                  <Dot color={g.dept.color} />
                  <span className="font-semibold">{g.dept.name}</span>
                  <span className="num text-xs text-muted">
                    {dt.paidMembers}/{dt.members} выдано · {money(dt.net, cur)}
                  </span>
                  <div className="ml-auto">
                    {unpaidIds.length > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => st.setPaid(unpaidIds, true)}>
                        <CheckCheck size={15} /> Выдать всем в отделе
                      </Button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead>
                      <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-muted">
                        <th className="px-4 py-2 font-medium">Сотрудник</th>
                        <th className="px-2 py-2 font-medium">Паспорт</th>
                        <th className="px-2 py-2 text-right font-medium">Начислено</th>
                        <th className="px-2 py-2 font-medium">Способ</th>
                        <th className="px-2 py-2 text-right font-medium">Комиссия</th>
                        <th className="px-2 py-2 text-right font-medium">К выдаче</th>
                        <th className="px-2 py-2 font-medium">Статус</th>
                        <th className="px-4 py-2 font-medium">Примечание</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.employees.map((e) => {
                        const l = calc.lines[e.id];
                        const en = entries[e.id];
                        const pos = config.positions.find((p) => p.id === e.positionId);
                        return (
                          <motion.tr layout key={e.id} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                            <td className="px-4 py-2.5">
                              <button onClick={() => setDrawer(e.id)} className="flex cursor-pointer items-center gap-2.5 text-left">
                                <Avatar name={e.name} color={g.dept.color} size={30} />
                                <div>
                                  <div className="font-medium hover:underline decoration-white/30 underline-offset-2">{e.name}</div>
                                  <div className="text-[11px] text-muted">
                                    {pos?.name}
                                    {l.capped && <span className="ml-1.5 text-warn">· лимит</span>}
                                  </div>
                                </div>
                              </button>
                            </td>
                            <td className="px-2">
                              <button
                                onClick={() => {
                                  navigator.clipboard?.writeText(e.passport);
                                  toast.success(`Паспорт ${e.passport} скопирован`);
                                }}
                                className="group/p inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-[13px] text-fg-2 hover:bg-white/[0.05]"
                              >
                                {e.passport || <span className="text-bad">нет</span>}
                                <Copy size={12} className="opacity-0 transition group-hover/p:opacity-60" />
                              </button>
                            </td>
                            <td className="num px-2 text-right font-mono text-fg-2">{money(l.gross)}</td>
                            <td className="px-2">
                              <Segmented
                                size="sm"
                                value={l.methodId}
                                onChange={(v) => st.setMethod(e.id, v)}
                                options={config.methods.map((m) => ({ value: m.id, label: m.name }))}
                              />
                            </td>
                            <td className={cn("num px-2 text-right font-mono", l.commission ? "text-bad/80" : "text-faint")}>
                              {l.commission ? "−" + money(l.commission) : "0"}
                            </td>
                            <td className="num px-2 text-right font-mono text-[14px] font-semibold">{money(l.net)}</td>
                            <td className="px-2">
                              <button
                                onClick={() => st.setPaid([e.id], !l.paid)}
                                className={cn(
                                  "inline-flex h-8 min-w-[150px] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-[13px] font-medium transition active:scale-95",
                                  l.paid
                                    ? "border border-good/25 bg-good/12 text-good hover:bg-good/20"
                                    : "border border-white/10 bg-white/[0.04] text-fg-2 hover:border-accent/50 hover:bg-accent/15 hover:text-fg",
                                )}
                              >
                                {l.paid ? (
                                  <>
                                    <Check size={15} /> Выдано {en?.paidAt ? dmy(en.paidAt).slice(0, 5) : ""}
                                  </>
                                ) : (
                                  "Выдать"
                                )}
                              </button>
                              {l.paid && en?.paidAmount != null && en.paidAmount !== l.net && (
                                <div className="num mt-1 text-[11px] text-warn" title="Баллы изменили после отметки о выдаче">
                                  ⚠ выдано {money(en.paidAmount)}, разница {l.net - en.paidAmount > 0 ? "+" : ""}
                                  {money(l.net - en.paidAmount)}
                                </div>
                              )}
                            </td>
                            <td className="px-4">
                              <input
                                key={en?.note ?? ""}
                                defaultValue={en?.note ?? ""}
                                onBlur={(ev) => ev.target.value !== (en?.note ?? "") && st.setNote(e.id, ev.target.value)}
                                onKeyDown={(ev) => ev.key === "Enter" && (ev.target as HTMLInputElement).blur()}
                                placeholder="—"
                                className="h-8 w-full min-w-[140px] rounded-lg border border-transparent bg-transparent px-2 text-[13px] text-fg-2 outline-none placeholder:text-faint hover:border-white/[0.08] focus:border-accent/50 focus:bg-white/[0.04]"
                              />
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <EmployeeDrawer id={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
