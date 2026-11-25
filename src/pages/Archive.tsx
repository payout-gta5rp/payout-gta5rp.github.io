import { ArrowLeft, Archive as ArchiveIcon, Check, FileSpreadsheet, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, Badge, Button, Card, Dot, Empty, Modal, PageHeader, Stat } from "@/components/ui";
import { downloadWeekReport } from "@/export/report";
import { groupByDept, useArchiveCalcs } from "@/hooks";
import { cn, dmy, money, period } from "@/lib/format";
import { go } from "@/lib/router";
import { useStore } from "@/store";

export function ArchivePage({ id }: { id?: string }) {
  const items = useArchiveCalcs();
  const demo = useStore((s) => s.demo);
  const sel = id ? items.find((i) => i.week.id === id) : undefined;
  if (sel) return <WeekView item={sel} isLast={items[items.length - 1]?.week.id === sel.week.id} />;

  const list = [...items].reverse();
  const total = items.reduce((s, i) => s + i.calc.totals.gross, 0);
  return (
    <div>
      <PageHeader
        title="Архив недель"
        subtitle={
          <>
            Закрытые недели неизменяемы: хранят состав, суммы и тарифы на момент закрытия
            {demo && <Badge className="ml-2" color="#fbbf24">демо-данные</Badge>}
          </>
        }
      />
      {!list.length ? (
        <Card>
          <Empty icon={<ArchiveIcon size={24} />} title="Архив пуст" text="Закройте первую неделю — она появится здесь вместе с отчётом." />
        </Card>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Недель в архиве" value={items.length} accent="#8b6cff" />
            <Stat label="Начислено всего" value={money(total)} accent="#22d3ee" />
            <Stat label="В среднем за неделю" value={money(total / items.length)} accent="#34d399" />
            <Stat label="Последняя неделя" value={<span className="text-[18px]">{period(list[0].week.start)}</span>} accent="#fbbf24" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map(({ week, calc }) => {
              const max = Math.max(1, ...config(week).map((d) => calc.depts[d.id]?.gross ?? 0));
              return (
                <button
                  key={week.id}
                  onClick={() => go({ name: "archive", id: week.id })}
                  className="glass group cursor-pointer rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:border-white/15"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[15px] font-semibold">{period(week.start)}</div>
                      <div className="text-xs text-muted">закрыта {dmy(week.closedAt)}</div>
                    </div>
                    <Badge color={calc.totals.unpaidNet > 0 ? "#fb7185" : "#34d399"}>
                      {calc.totals.unpaidNet > 0 ? "есть невыданные" : "всё выдано"}
                    </Badge>
                  </div>
                  <div className="num mt-4 text-[24px] font-semibold tracking-tight">{money(calc.totals.gross)}</div>
                  <div className="text-xs text-muted">
                    {calc.totals.members} чел. · {calc.totals.points} баллов
                  </div>
                  <div className="mt-4 flex h-8 items-end gap-1">
                    {config(week).map((d) => (
                      <div
                        key={d.id}
                        title={`${d.name}: ${money(calc.depts[d.id]?.gross ?? 0)}`}
                        className="flex-1 rounded-t-[4px] opacity-80 transition group-hover:opacity-100"
                        style={{ background: d.color, height: `${Math.max(4, ((calc.depts[d.id]?.gross ?? 0) / max) * 100)}%` }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const config = (w: { config: { departments: { id: string; name: string; color: string }[] } }) => w.config.departments;

function WeekView({ item, isLast }: { item: ReturnType<typeof useArchiveCalcs>[number]; isLast: boolean }) {
  const { week, calc } = item;
  const [confirm, setConfirm] = useState(false);
  const cur = week.config.rules.currency;
  const groups = groupByDept(week.config.departments, week.members, week.config.positions.map((p) => p.id))
    .map((g) => ({ ...g, employees: g.employees.filter((e) => (calc.lines[e.id]?.gross ?? 0) > 0) }))
    .filter((g) => g.employees.length);

  return (
    <div>
      <button onClick={() => go({ name: "archive" })} className="mb-3 inline-flex cursor-pointer items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft size={15} /> Архив
      </button>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            Неделя <span className="text-gradient">{period(week.start)}</span>
          </span>
        }
        subtitle={`Закрыта ${new Date(week.closedAt).toLocaleString("ru-RU")} · только просмотр`}
        actions={
          <>
            {isLast && (
              <Button variant="ghost" onClick={() => setConfirm(true)}>
                <RotateCcw size={15} /> Открыть заново
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => toast.promise(downloadWeekReport(week), { loading: "Готовлю отчёт…", success: "Отчёт скачан", error: "Ошибка" })}
            >
              <FileSpreadsheet size={16} /> Отчёт .xlsx
            </Button>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Начислено" value={money(calc.totals.gross)} sub={cur} accent="#8b6cff" />
        <Stat label="К выдаче" value={money(calc.totals.net)} sub={`комиссия ${money(calc.totals.commission)}`} accent="#22d3ee" />
        <Stat label="Сотрудников" value={calc.totals.members} sub={`${calc.totals.points} баллов`} accent="#34d399" />
        <Stat label="Не выдано" value={money(calc.totals.unpaidNet)} sub={`${calc.totals.members - calc.totals.paidCount} чел.`} accent="#fb7185" />
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-4 py-3 font-medium">Сотрудник</th>
              <th className="px-2 py-3 font-medium">Паспорт</th>
              <th className="px-2 py-3 text-right font-medium">Баллы</th>
              <th className="px-2 py-3 text-right font-medium">Начислено</th>
              <th className="px-2 py-3 text-right font-medium">К выдаче</th>
              <th className="px-4 py-3 font-medium">Статус</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Rows key={g.dept.id} g={g} calc={calc} week={week} />
            ))}
          </tbody>
        </table>
      </Card>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Открыть неделю заново?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Отмена
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                useStore.getState().reopenLast();
                setConfirm(false);
                toast.success("Неделя снова открыта для правок");
                go({ name: "week" });
              }}
            >
              Открыть заново
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Неделя уйдёт из архива и станет текущей. Данные текущей открытой недели ({period(useStore.getState().current.start)}) будут
          заменены. Действие попадёт в журнал.
        </p>
      </Modal>
    </div>
  );
}

function Rows({ g, calc, week }: { g: ReturnType<typeof groupByDept>[number]; calc: ReturnType<typeof useArchiveCalcs>[number]["calc"]; week: ReturnType<typeof useArchiveCalcs>[number]["week"] }) {
  return (
    <>
      <tr>
        <td colSpan={6} className="border-t border-white/[0.06] bg-white/[0.02] px-4 py-2">
          <span className="flex items-center gap-2 text-[13px] font-semibold">
            <Dot color={g.dept.color} /> {g.dept.name}
          </span>
        </td>
      </tr>
      {g.employees.map((e) => {
        const l = calc.lines[e.id];
        const en = week.entries[e.id];
        return (
          <tr key={e.id} className="border-t border-white/[0.04]">
            <td className="px-4 py-2">
              <span className="flex items-center gap-2.5">
                <Avatar name={e.name} color={g.dept.color} size={26} />
                {e.name}
              </span>
            </td>
            <td className="px-2 font-mono text-fg-2">{e.passport}</td>
            <td className="num px-2 text-right font-mono text-fg-2">{l.points}</td>
            <td className="num px-2 text-right font-mono">{money(l.gross)}</td>
            <td className="num px-2 text-right font-mono font-semibold">{money(l.net)}</td>
            <td className="px-4">
              <span className={cn("inline-flex items-center gap-1.5 text-[13px]", l.paid ? "text-good" : "text-bad")}>
                {l.paid ? <Check size={14} /> : <X size={14} />}
                {l.paid ? `Выдано${en?.paidAt ? " " + dmy(en.paidAt) : ""}` : "Не выдано"}
              </span>
            </td>
          </tr>
        );
      })}
    </>
  );
}
