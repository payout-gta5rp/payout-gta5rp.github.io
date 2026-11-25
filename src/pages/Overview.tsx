import { ArrowRight, Calculator, Crown, FileSpreadsheet, History, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ShareBars, Sparkline, WeekBars } from "@/components/charts";
import { Avatar, Button, Card, Progress, Segmented, Stat } from "@/components/ui";
import { downloadCurrentReport } from "@/export/report";
import { useArchiveCalcs, useCurrentCalc } from "@/hooks";
import { cn, money, period, periodShort, plural, timeAgo } from "@/lib/format";
import { go } from "@/lib/router";
import { useStore } from "@/store";

type Range = "4" | "8" | "12" | "all";

export function OverviewPage() {
  const config = useStore((s) => s.config);
  const employees = useStore((s) => s.employees);
  const start = useStore((s) => s.current.start);
  const log = useStore((s) => s.log);
  const demo = useStore((s) => s.demo);
  const calc = useCurrentCalc();
  const archive = useArchiveCalcs();
  const [range, setRange] = useState<Range>("8");
  const cur = config.rules.currency;

  const weeks = useMemo(() => {
    const all = [
      ...archive.map((a) => ({ start: a.week.start, id: a.week.id, calc: a.calc, members: a.week.members, current: false })),
      { start, id: "current", calc, members: employees, current: true },
    ];
    return range === "all" ? all : all.slice(-Number(range));
  }, [archive, calc, start, employees, range]);

  const closed = weeks.filter((w) => !w.current);
  const avg = closed.length ? closed.reduce((s, w) => s + w.calc.totals.gross, 0) / closed.length : 0;
  const prev = archive[archive.length - 1]?.calc.totals.gross ?? 0;
  const delta = prev ? (calc.totals.gross - prev) / prev : 0;

  // Отделы и топ за период
  const { depts, top } = useMemo(() => {
    const byDept = new Map<string, number>();
    const byEmp = new Map<string, { name: string; deptId: string; total: number; series: number[] }>();
    weeks.forEach((w, wi) => {
      for (const l of Object.values(w.calc.lines)) {
        if (l.gross <= 0) continue;
        byDept.set(l.deptId, (byDept.get(l.deptId) ?? 0) + l.gross);
        const m = w.members.find((x) => x.id === l.employeeId);
        if (!m) continue;
        const e = byEmp.get(l.employeeId) ?? { name: m.name, deptId: m.deptId, total: 0, series: Array(weeks.length).fill(0) };
        e.total += l.gross;
        e.series[wi] = l.gross;
        byEmp.set(l.employeeId, e);
      }
    });
    return {
      depts: config.departments
        .map((d) => ({ key: d.id, label: d.name, color: d.color, value: byDept.get(d.id) ?? 0 }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value),
      top: [...byEmp.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total).slice(0, 6),
    };
  }, [weeks, config.departments]);

  const t = calc.totals;
  const leader = calc.leader ? employees.find((e) => e.id === calc.leader!.employeeId) : null;
  const deptById = new Map(config.departments.map((d) => [d.id, d]));

  return (
    <div className="space-y-5">
      {/* Герой */}
      <Card className="relative overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute -right-24 -top-32 size-[420px] rounded-full bg-gradient-to-br from-accent/30 to-accent-2/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 left-1/3 size-[360px] rounded-full bg-good/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-8">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="size-1.5 animate-pulse rounded-full bg-good" />
              {config.short} · текущая неделя · {period(start)}
            </div>
            <div className="num mt-3 text-[44px] font-semibold leading-none tracking-tight md:text-[56px]">
              <span className="text-gradient">{money(t.net)}</span>
              <span className="ml-3 text-xl font-medium text-muted">{cur} к выдаче</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-fg-2">
              <span>
                {t.members} {plural(t.members, "сотрудник", "сотрудника", "сотрудников")} в премии
              </span>
              <span>{t.points.toLocaleString("ru-RU")} баллов</span>
              {prev > 0 && t.gross > 0 && (
                <span className={cn("flex items-center gap-1", delta >= 0 ? "text-good" : "text-bad")}>
                  {delta >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                  {delta >= 0 ? "+" : ""}
                  {Math.round(delta * 100)}% к прошлой неделе
                </span>
              )}
            </div>
            <div className="mt-5 max-w-md">
              <div className="mb-1.5 flex justify-between text-xs text-muted">
                <span>Выдано {t.paidCount} из {t.members}</span>
                <span className="num">{money(t.paidNet)} / {money(t.net)}</span>
              </div>
              <Progress value={t.members ? t.paidCount / t.members : 0} className="h-2" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="lg" onClick={() => go({ name: "week" })}>
              <Calculator size={17} /> Ввод недели
            </Button>
            <Button size="lg" onClick={() => go({ name: "payouts" })}>
              <Wallet size={17} /> Ведомость
            </Button>
            <Button
              size="lg"
              onClick={() => toast.promise(downloadCurrentReport(), { loading: "Готовлю отчёт…", success: "Отчёт .xlsx скачан", error: "Не получилось" })}
            >
              <FileSpreadsheet size={17} className="text-good" /> Отчёт
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Начислено за неделю" icon={<Wallet size={14} />} value={money(t.gross)} sub={avg ? `в среднем ${money(avg)} за неделю` : cur} accent="#8b6cff" />
        <Stat label="Комиссия" icon={<FileSpreadsheet size={14} />} value={money(t.commission)} sub="электронные переводы" accent="#22d3ee" />
        <Stat label="Средний балл" icon={<Users size={14} />} value={t.members ? Math.round(t.points / t.members) : 0} sub="на сотрудника в премии" accent="#34d399" />
        <Stat label="Лидер недели" icon={<Crown size={14} />} value={<span className="text-[18px]">{leader?.name ?? "—"}</span>} sub={calc.leader ? `${calc.leader.points} баллов` : ""} accent="#fbbf24" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-semibold">Начислено по неделям</div>
              <div className="text-xs text-muted">
                Штриховка — текущая открытая неделя{demo ? " · прошлые недели — демо-данные" : ""}
              </div>
            </div>
            <Segmented
              size="sm"
              value={range}
              onChange={setRange}
              options={[
                { value: "4", label: "4 нед" },
                { value: "8", label: "8 нед" },
                { value: "12", label: "3 мес" },
                { value: "all", label: "Всё" },
              ]}
            />
          </div>
          <WeekBars
            currency={cur}
            data={weeks.map((w) => ({
              key: w.id,
              label: periodShort(w.start),
              value: w.calc.totals.gross,
              sub: `${w.calc.totals.members} чел. · ${w.calc.totals.points} баллов`,
              current: w.current,
            }))}
            onSelect={(id) => go(id === "current" ? { name: "week" } : { name: "archive", id })}
          />
        </Card>

        <Card className="p-5">
          <div className="mb-5">
            <div className="font-semibold">По отделам</div>
            <div className="text-xs text-muted">Начислено за выбранный период</div>
          </div>
          {depts.length ? <ShareBars data={depts} currency={cur} /> : <div className="py-10 text-center text-sm text-muted">Нет данных</div>}
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="font-semibold">Топ за период</div>
              <div className="text-xs text-muted">По сумме начислений</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => go({ name: "employees" })}>
              Все сотрудники <ArrowRight size={14} />
            </Button>
          </div>
          <div className="space-y-1">
            {top.map((e, i) => {
              const d = deptById.get(e.deptId);
              return (
                <button
                  key={e.id}
                  onClick={() => go({ name: "employees", id: e.id })}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.04]"
                >
                  <span className={cn("w-5 text-center font-mono text-xs", i < 3 ? "text-warn" : "text-faint")}>{i + 1}</span>
                  <Avatar name={e.name} color={d?.color} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{e.name}</div>
                    <div className="text-[11px] text-muted">{d?.name}</div>
                  </div>
                  <Sparkline values={e.series} color={d?.color ?? "#8b6cff"} width={96} height={28} />
                  <span className="num w-28 text-right font-mono text-sm font-semibold">{money(e.total)}</span>
                </button>
              );
            })}
            {!top.length && <div className="py-8 text-center text-sm text-muted">Пока пусто</div>}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2 font-semibold">
            <History size={16} className="text-muted" /> Журнал изменений
          </div>
          <div className="space-y-0.5">
            {log.slice(0, 9).map((l) => (
              <div key={l.id} className="flex gap-3 rounded-lg px-2 py-1.5 text-[13px]">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent/70" />
                <span className="flex-1 text-fg-2">{l.text}</span>
                <span className="shrink-0 text-[11px] text-faint">{timeAgo(l.at)}</span>
              </div>
            ))}
            {!log.length && <div className="py-8 text-center text-sm text-muted">Здесь появятся все правки: кто, что и когда изменил</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
