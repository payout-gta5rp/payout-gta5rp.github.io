import { ArrowDown, ArrowUp, Building2, Download, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { SCHEMA_VERSION, migrateWorkspace } from "@/data/migrate";
import { useUi } from "@/uiStore";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { calcWeek } from "@/engine/calc";
import type { Employee, Entry } from "@/engine/types";
import { toast } from "sonner";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Segmented, Select } from "@/components/ui";
import { emptyWorkspace, type Workspace } from "@/data/templates";
import type { BaseMode, OrgConfig } from "@/engine/types";
import { modeName } from "@/export/report";
import { cn, money } from "@/lib/format";
import { useCurrentCalc } from "@/hooks";
import { go } from "@/lib/router";
import { exportWorkspace, uid, useStore } from "@/store";

const TABS = [
  { value: "general", label: "Общие" },
  { value: "departments", label: "Отделы" },
  { value: "positions", label: "Должности" },
  { value: "actions", label: "Действия" },
  { value: "methods", label: "Выплаты" },
  { value: "data", label: "Данные" },
];

export function SettingsPage({ tab = "general" }: { tab?: string }) {
  return (
    <div>
      <PageHeader
        title="Настройки"
        subtitle="Правила расчёта вашей организации. Изменения сразу применяются к открытой неделе, закрытые недели не меняются."
      />
      <div className="mb-5 max-w-full overflow-x-auto">
        <Segmented value={tab} onChange={(v) => go({ name: "settings", tab: v })} options={TABS} />
      </div>
      {tab === "general" && <General />}
      {tab === "departments" && <Departments />}
      {tab === "positions" && <Positions />}
      {tab === "actions" && <Actions />}
      {tab === "methods" && <Methods />}
      {tab === "data" && <Data />}
    </div>
  );
}

const upd = (fn: (c: OrgConfig) => void) => useStore.getState().updateConfig(fn);

/** Числовое поле, которое сохраняет значение по Enter/потере фокуса. */
function Num({
  value,
  onCommit,
  placeholder,
  className,
  allowEmpty,
}: {
  value: number | null | undefined;
  onCommit: (v: number | null) => void;
  placeholder?: string;
  className?: string;
  allowEmpty?: boolean;
}) {
  return (
    <Input
      key={String(value)}
      defaultValue={value == null ? "" : String(value)}
      placeholder={placeholder}
      inputMode="decimal"
      className={cn("num font-mono", className)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      onBlur={(e) => {
        const raw = e.target.value.replace(/\s/g, "").replace(",", ".");
        if (raw === "") return allowEmpty ? onCommit(null) : undefined;
        const n = Number(raw);
        if (!Number.isNaN(n)) onCommit(n);
      }}
    />
  );
}

function Text({ value, onCommit, className, placeholder }: { value: string; onCommit: (v: string) => void; className?: string; placeholder?: string }) {
  return (
    <Input
      key={value}
      defaultValue={value}
      placeholder={placeholder}
      className={className}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      onBlur={(e) => e.target.value.trim() && e.target.value !== value && onCommit(e.target.value.trim())}
    />
  );
}

function Section({ title, text, children, action }: { title: string; text?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{title}</div>
          {text && <div className="mt-0.5 max-w-2xl text-xs text-muted">{text}</div>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function RowTools({ onUp, onDown, onDelete, canDelete = true }: { onUp: () => void; onDown: () => void; onDelete: () => void; canDelete?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <IconBtn onClick={onUp}>
        <ArrowUp size={14} />
      </IconBtn>
      <IconBtn onClick={onDown}>
        <ArrowDown size={14} />
      </IconBtn>
      <IconBtn onClick={onDelete} danger disabled={!canDelete}>
        <Trash2 size={14} />
      </IconBtn>
    </div>
  );
}

function IconBtn({ children, onClick, danger, disabled }: { children: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-8 cursor-pointer place-items-center rounded-lg text-muted transition disabled:pointer-events-none disabled:opacity-25",
        danger ? "hover:bg-bad/10 hover:text-bad" : "hover:bg-white/[0.06] hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function moveIn<T>(arr: T[], i: number, d: number) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

// ─────────────────────────── Общие ───────────────────────────

function General() {
  const c = useStore((s) => s.config);
  const r = c.rules;
  const hasBudget = c.departments.some((d) => d.mode === "budgetShare" || d.mode === "fixed");
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Section title="Организация">
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Field label="Полное название">
            <Text value={c.name} onCommit={(v) => upd((x) => void (x.name = v))} />
          </Field>
          <Field label="Короткое">
            <Text value={c.short} onCommit={(v) => upd((x) => void (x.short = v))} />
          </Field>
          <Field label="Валюта">
            <Text value={r.currency} onCommit={(v) => upd((x) => void (x.rules.currency = v))} />
          </Field>
        </div>
      </Section>
      <Section title="Расчёт" text="Цена балла применяется к отделам с основой «Баллы». Лимит ограничивает сумму на человека за неделю.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Цена балла">
            <Num value={r.pointPrice} onCommit={(v) => upd((x) => void (x.rules.pointPrice = v ?? 0))} />
          </Field>
          <Field label="Недельный лимит на человека" hint="Пусто — без лимита">
            <Num value={r.weeklyCap} allowEmpty placeholder="без лимита" onCommit={(v) => upd((x) => void (x.rules.weeklyCap = v))} />
          </Field>
          <Field label="Округление">
            <Select
              value={r.rounding.mode}
              onChange={(v) => upd((x) => void (x.rules.rounding.mode = v as OrgConfig["rules"]["rounding"]["mode"]))}
              options={[
                { value: "none", label: "Без округления" },
                { value: "floor", label: "Вниз" },
                { value: "round", label: "Математически" },
              ]}
            />
          </Field>
          <Field label="Шаг округления">
            <Num value={r.rounding.step} onCommit={(v) => upd((x) => void (x.rules.rounding.step = Math.max(1, v ?? 1)))} />
          </Field>
        </div>
      </Section>
      {hasBudget && (
        <Section title="Бюджет" text="Для отделов на ставках и долях бюджета. Остаток после ставок делится между отделами по весам.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Общий недельный бюджет">
              <Num value={r.budget} onCommit={(v) => upd((x) => void (x.rules.budget = v ?? 0))} />
            </Field>
            <Field label="Остаток после округления">
              <Select
                value={r.remainder}
                onChange={(v) => upd((x) => void (x.rules.remainder = v as OrgConfig["rules"]["remainder"]))}
                options={[
                  { value: "none", label: "Не распределять" },
                  { value: "largest", label: "Наибольшей доле" },
                  { value: "proportional", label: "Пропорционально" },
                ]}
              />
            </Field>
          </div>
        </Section>
      )}
      <div className="xl:col-span-2">
        <Calculator />
      </div>
    </div>
  );
}

// ─────────────────────────── Калькулятор ───────────────────────────

function Calculator() {
  const config = useStore((s) => s.config);
  const employees = useStore((s) => s.employees);
  const [deptId, setDeptId] = useState(config.departments[0]?.id ?? "");
  const [posId, setPosId] = useState(config.positions[0]?.id ?? "");
  const [val, setVal] = useState("100");
  const [methodId, setMethodId] = useState(config.rules.defaultMethodId);
  const dept = config.departments.find((d) => d.id === deptId) ?? config.departments[0];
  const n = Number(val.replace(",", ".")) || 0;

  const line = useMemo(() => {
    if (!dept) return null;
    const cfg = structuredClone(config);
    const probe: Employee = { id: "__probe", name: "Проверка", passport: "0", deptId: dept.id, positionId: posId, active: true };
    const entry: Entry = { counts: {}, adjustments: [], paid: false, methodId };
    if (dept.mode === "points") {
      cfg.actions = [{ id: "__p", code: "P", short: "Баллы", name: "Баллы", group: "", points: 1 }];
      entry.counts = { __p: n };
    } else if (dept.mode === "budgetShare") entry.share = n;
    else if (dept.mode === "manual") entry.manual = n;
    // Остальные сотрудники нужны, чтобы правильно посчитать фикс. ставки и остаток бюджета
    const others = employees.filter((e) => config.departments.find((d) => d.id === e.deptId)?.mode === "fixed");
    return calcWeek(cfg, [...others, probe], { __probe: entry }).lines.__probe;
  }, [config, employees, dept, posId, n, methodId]);

  const inputLabel =
    dept?.mode === "points" ? "Баллов за неделю" : dept?.mode === "budgetShare" ? "% вклада в отделе" : dept?.mode === "manual" ? "Сумма" : "";

  return (
    <Section title="Проверка расчёта" text="Подставьте условного сотрудника и посмотрите, сколько он получит по текущим правилам — шаг за шагом.">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="grid content-start gap-3 sm:grid-cols-2">
          <Field label="Отдел">
            <Select value={dept?.id ?? ""} onChange={setDeptId} options={config.departments.map((d) => ({ value: d.id, label: `${d.name} · ${modeName(d.mode)}` }))} />
          </Field>
          <Field label="Должность">
            <Select value={posId} onChange={setPosId} options={config.positions.map((p) => ({ value: p.id, label: p.name }))} />
          </Field>
          {inputLabel && (
            <Field label={inputLabel}>
              <Input value={val} onChange={(e) => setVal(e.target.value)} inputMode="decimal" className="font-mono" />
            </Field>
          )}
          <Field label="Способ выплаты">
            <Select value={methodId} onChange={setMethodId} options={config.methods.map((m) => ({ value: m.id, label: m.name }))} />
          </Field>
        </div>
        <div className="overflow-hidden rounded-xl border border-white/[0.07]">
          {line?.steps.map((s, i) => {
            const last = i === line.steps.length - 1;
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 text-sm",
                  i > 0 && "border-t border-white/[0.05]",
                  last && "bg-gradient-to-r from-accent/15 to-accent-2/10",
                )}
              >
                <span className="grid size-5 place-items-center rounded-md bg-white/[0.06] text-[10px] text-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className={cn(last && "font-semibold")}>{s.label}</div>
                  {s.hint && <div className="truncate text-[11px] text-muted">{s.hint}</div>}
                </div>
                <div className={cn("num font-mono", last ? "text-[15px] font-semibold" : "text-fg-2", s.value < 0 && "text-bad")}>
                  {s.label === "Баллы" ? s.value : money(s.value)}
                </div>
              </div>
            );
          })}
          {!line && <div className="p-6 text-center text-sm text-muted">Добавьте отдел и должность</div>}
        </div>
      </div>
    </Section>
  );
}

// ─────────────────────────── Отделы ───────────────────────────

function Departments() {
  const c = useStore((s) => s.config);
  const employees = useStore((s) => s.employees);
  const calc = useCurrentCalc();
  const wSum = c.departments.filter((d) => d.mode === "budgetShare").reduce((s, d) => s + (d.weight ?? 0), 0);
  const anyShare = c.departments.some((d) => d.mode === "budgetShare");
  const pool = calc.budget?.pool ?? 0;
  const PALETTE = ["#b8860b", "#4f8cff", "#14a58a", "#9466f5", "#ef5350", "#c34fcb", "#6f9a1f"];
  return (
    <Section
      title="Отделы"
      text="У каждого отдела своя основа расчёта: баллы за действия, доля бюджета, фиксированная ставка должности или сумма вручную."
      action={
        <Button
          size="sm"
          onClick={() =>
            upd((x) =>
              void x.departments.push({
                id: uid(),
                name: "Новый отдел",
                color: PALETTE[x.departments.length % PALETTE.length],
                mode: "points",
              }),
            )
          }
        >
          <Plus size={15} /> Отдел
        </Button>
      }
    >
      {anyShare && calc.budget && (
        <div className="mb-4 grid gap-2 sm:grid-cols-4">
          {[
            ["Общий бюджет", money(calc.budget.total)],
            ["Фикс. ставки", money(calc.budget.fixed)],
            ["Остаток на отделы", money(pool)],
            ["Сумма весов", `${Math.round(wSum * 10) / 10}%`],
          ].map(([k, v], i) => (
            <div
              key={k}
              className={cn(
                "rounded-xl border px-3 py-2",
                i === 3 && Math.abs(wSum - 100) > 0.5 ? "border-warn/30 bg-warn/[0.07]" : "border-white/[0.06] bg-white/[0.02]",
              )}
            >
              <div className="text-[11px] text-muted">{k}</div>
              <div className={cn("num font-mono text-sm font-semibold", i === 3 && (Math.abs(wSum - 100) > 0.5 ? "text-warn" : "text-good"))}>{v}</div>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2">
        {c.departments.map((d, i) => {
          const count = employees.filter((e) => e.deptId === d.id).length;
          return (
            <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
              <input
                type="color"
                value={d.color}
                onChange={(e) => upd((x) => void (x.departments[i].color = e.target.value))}
                className="size-9 cursor-pointer rounded-lg border-0 bg-transparent p-0"
              />
              <Text value={d.name} onCommit={(v) => upd((x) => void (x.departments[i].name = v))} className="w-44" />
              <Select
                className="w-44"
                value={d.mode}
                onChange={(v) => upd((x) => void (x.departments[i].mode = v as BaseMode))}
                options={(["points", "budgetShare", "fixed", "manual"] as BaseMode[]).map((m) => ({ value: m, label: modeName(m) }))}
              />
              {d.mode === "budgetShare" && (
                <div className="flex items-center gap-1.5">
                  <Num value={d.weight ?? 0} onCommit={(v) => upd((x) => void (x.departments[i].weight = v ?? 0))} className="w-20" />
                  <span className="text-xs text-muted">%</span>
                  <span className="px-1 text-faint">⇄</span>
                  <Num
                    value={calc.depts[d.id]?.budget ?? 0}
                    onCommit={(v) =>
                      pool > 0 && upd((x) => void (x.departments[i].weight = Math.round(((v ?? 0) / pool) * 1000) / 10))
                    }
                    className="w-32"
                  />
                  <span className="text-xs text-muted">{c.rules.currency}</span>
                </div>
              )}
              {d.mode === "points" && (
                <div className="flex items-center gap-1.5" title="Пусто — общая цена балла из «Общие»">
                  <span className="text-xs text-muted">цена балла</span>
                  <Num
                    value={d.pointPrice}
                    allowEmpty
                    placeholder={String(c.rules.pointPrice)}
                    onCommit={(v) => upd((x) => void (x.departments[i].pointPrice = v))}
                    className="w-24"
                  />
                </div>
              )}
              <span className="ml-auto text-xs text-muted">{count} чел.</span>
              <RowTools
                onUp={() => upd((x) => moveIn(x.departments, i, -1))}
                onDown={() => upd((x) => moveIn(x.departments, i, 1))}
                canDelete={count === 0}
                onDelete={() => upd((x) => void x.departments.splice(i, 1))}
              />
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ─────────────────────────── Должности ───────────────────────────

function Positions() {
  const c = useStore((s) => s.config);
  const employees = useStore((s) => s.employees);
  const hasFixed = c.departments.some((d) => d.mode === "fixed");
  return (
    <Section
      title="Должности и звания"
      text="Множитель в процентах: 100 = ×1.0, 130 = ×1.3. Порядок здесь задаёт порядок сотрудников в таблицах."
      action={
        <Button size="sm" onClick={() => upd((x) => void x.positions.push({ id: uid(), name: "Новая должность", multiplier: 100 }))}>
          <Plus size={15} /> Должность
        </Button>
      }
    >
      <div className="mb-2 hidden grid-cols-[1fr_110px_140px_140px_104px] gap-2 px-2 text-[11px] uppercase tracking-wider text-muted md:grid">
        <span>Название</span>
        <span>Множитель, %</span>
        <span>{hasFixed ? "Ставка" : ""}</span>
        <span>Свой лимит</span>
        <span />
      </div>
      <div className="space-y-2">
        {c.positions.map((p, i) => {
          const count = employees.filter((e) => e.positionId === p.id).length;
          return (
            <div key={p.id} className="grid items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2 md:grid-cols-[1fr_110px_140px_140px_104px]">
              <div className="flex items-center gap-2">
                <Text value={p.name} onCommit={(v) => upd((x) => void (x.positions[i].name = v))} />
                {count > 0 && <Badge>{count}</Badge>}
              </div>
              <Num value={p.multiplier} onCommit={(v) => upd((x) => void (x.positions[i].multiplier = v ?? 100))} />
              {hasFixed ? (
                <Num value={p.fixedRate} allowEmpty placeholder="—" onCommit={(v) => upd((x) => void (x.positions[i].fixedRate = v ?? undefined))} />
              ) : (
                <span />
              )}
              <Num value={p.cap} allowEmpty placeholder="общий" onCommit={(v) => upd((x) => void (x.positions[i].cap = v))} />
              <RowTools
                onUp={() => upd((x) => moveIn(x.positions, i, -1))}
                onDown={() => upd((x) => moveIn(x.positions, i, 1))}
                canDelete={count === 0}
                onDelete={() => upd((x) => void x.positions.splice(i, 1))}
              />
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ─────────────────────────── Действия ───────────────────────────

function Actions() {
  const c = useStore((s) => s.config);
  const [q, setQ] = useState("");
  const [ask, setAsk] = useState<{ title: string; value: string; ok: (v: string) => void } | null>(null);
  const pointDepts = c.departments.filter((d) => d.mode === "points");
  const groups = [...new Set(c.actions.map((a) => a.group))];
  const codeCount = new Map<string, number>();
  for (const a of c.actions) codeCount.set(a.code.toLowerCase(), (codeCount.get(a.code.toLowerCase()) ?? 0) + 1);
  const query = q.trim().toLowerCase();
  const match = (a: OrgConfig["actions"][number]) =>
    !query || (a.code + " " + a.short + " " + a.name + " " + a.group).toLowerCase().includes(query);

  const addTo = (group: string) =>
    upd((x) => {
      // вставляем в конец своего блока, чтобы столбцы шли подряд
      let at = -1;
      x.actions.forEach((a, i) => a.group === group && (at = i));
      const prefix = group.split(/[\s/]/)[0].toUpperCase().slice(0, 4) || "ACT";
      const n = x.actions.filter((a) => a.group === group).length + 1;
      const act = { id: uid(), code: `${prefix}-${String(n).padStart(2, "0")}`, group, short: "Новое", name: "Новое действие", points: 1 };
      x.actions.splice(at + 1 || x.actions.length, 0, act);
    });

  return (
    <div className="space-y-4">
      <Section
        title="Каталог действий"
        text="За что начисляются баллы. Блок группирует столбцы на экране ввода. «Обычный максимум» не запрещает ввод, а подсвечивает подозрительные цифры. Выключенные действия скрыты из ввода, но остаются в старых неделях."
        action={
          <div className="flex gap-2">
            <Input placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-44" />
            <Button size="sm" onClick={() => setAsk({ title: "Новый блок действий", value: "", ok: (v) => addTo(v) })}>
              <Plus size={15} /> Блок
            </Button>
          </div>
        }
      >
        <div className="hidden grid-cols-[92px_120px_1fr_70px_80px_64px_104px] gap-2 px-2 text-[11px] uppercase tracking-wider text-muted lg:grid">
          <span>Код</span>
          <span>Коротко</span>
          <span>Полное название</span>
          <span>Баллы</span>
          <span title="Обычный максимум за неделю">Макс/нед</span>
          <span>Вкл.</span>
          <span />
        </div>
      </Section>

      {groups.map((g) => {
        const list = c.actions.map((a, i) => ({ a, i })).filter(({ a }) => a.group === g && match(a));
        if (!list.length) return null;
        const color = c.departments.find((d) => g.toLowerCase().startsWith(d.name.toLowerCase()))?.color ?? "#8b6cff";
        return (
          <Card key={g} className="p-3">
            <div className="mb-2 flex items-center gap-2 px-1">
              <span
                className="rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
                style={{ color, background: color + "1c" }}
              >
                {g}
              </span>
              <span className="text-xs text-muted">{list.length}</span>
              <button
                onClick={() =>
                  setAsk({
                    title: "Переименовать блок",
                    value: g,
                    ok: (name) => name !== g && upd((x) => x.actions.forEach((a) => a.group === g && (a.group = name))),
                  })
                }
                className="cursor-pointer text-xs text-muted hover:text-fg"
              >
                переименовать
              </button>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => addTo(g)}>
                <Plus size={14} /> Действие
              </Button>
            </div>
            <div className="space-y-1.5">
              {list.map(({ a, i }) => {
                const dup = (codeCount.get(a.code.toLowerCase()) ?? 0) > 1;
                return (
                  <div key={a.id} className={cn("rounded-xl border border-white/[0.06] bg-white/[0.02] p-1.5", a.archived && "opacity-50")}>
                    <div className="grid items-center gap-2 lg:grid-cols-[92px_120px_1fr_70px_80px_64px_104px]">
                      <Text
                        value={a.code}
                        onCommit={(v) => upd((x) => void (x.actions[i].code = v))}
                        className={cn("font-mono text-xs", dup && "!border-bad/60 text-bad")}
                      />
                      <Text value={a.short} onCommit={(v) => upd((x) => void (x.actions[i].short = v))} />
                      <Text value={a.name} onCommit={(v) => upd((x) => void (x.actions[i].name = v))} />
                      <Num value={a.points} onCommit={(v) => upd((x) => void (x.actions[i].points = v ?? 0))} />
                      <Num value={a.maxPerWeek} allowEmpty placeholder="—" onCommit={(v) => upd((x) => void (x.actions[i].maxPerWeek = v))} />
                      <Toggle on={!a.archived} onClick={() => upd((x) => void (x.actions[i].archived = !x.actions[i].archived))} />
                      <RowTools
                        onUp={() => upd((x) => moveIn(x.actions, i, -1))}
                        onDown={() => upd((x) => moveIn(x.actions, i, 1))}
                        onDelete={() => upd((x) => void x.actions.splice(i, 1))}
                      />
                    </div>
                    {pointDepts.length > 1 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1 px-1">
                        <span className="mr-1 text-[11px] text-muted">Доступно:</span>
                        <Chip
                          on={!a.deptIds?.length}
                          onClick={() => upd((x) => void (x.actions[i].deptIds = null))}
                          label="всем отделам"
                        />
                        {pointDepts.map((d) => {
                          const on = !!a.deptIds?.includes(d.id);
                          return (
                            <Chip
                              key={d.id}
                              on={on}
                              color={d.color}
                              label={d.name}
                              onClick={() =>
                                upd((x) => {
                                  const cur = new Set(x.actions[i].deptIds ?? []);
                                  if (on) cur.delete(d.id);
                                  else cur.add(d.id);
                                  x.actions[i].deptIds = cur.size ? [...cur] : null;
                                })
                              }
                            />
                          );
                        })}
                      </div>
                    )}
                    {dup && <div className="px-1 pt-1 text-[11px] text-bad">Код повторяется — сделайте его уникальным, чтобы отчёт читался однозначно.</div>}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
      {!c.actions.length && (
        <Card className="py-10 text-center text-sm text-muted">
          Действий нет.{" "}
          <button className="cursor-pointer text-accent underline-offset-2 hover:underline" onClick={() => addTo("Общее")}>
            Добавить первое
          </button>
        </Card>
      )}
      <AskModal state={ask} onClose={() => setAsk(null)} />
    </div>
  );
}

function AskModal({ state, onClose }: { state: { title: string; value: string; ok: (v: string) => void } | null; onClose: () => void }) {
  const [v, setV] = useState("");
  const [prev, setPrev] = useState(state);
  if (state !== prev) {
    setPrev(state);
    setV(state?.value ?? "");
  }
  const submit = () => {
    if (!v.trim() || !state) return;
    state.ok(v.trim());
    onClose();
  };
  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={state?.title}
      width={420}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={submit} disabled={!v.trim()}>
            Готово
          </Button>
        </>
      }
    >
      <Input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Например: Патруль" />
    </Modal>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn("relative mx-auto h-5 w-9 cursor-pointer rounded-full transition", on ? "bg-gradient-to-r from-accent to-accent-2" : "bg-white/10")}
    >
      <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", on ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

function Chip({ on, onClick, label, color }: { on: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-full border px-2 py-0.5 text-[11px] transition",
        on ? "border-transparent text-fg" : "border-white/[0.08] text-muted hover:text-fg-2",
      )}
      style={on ? { background: (color ?? "#8b6cff") + "30", boxShadow: `inset 0 0 0 1px ${(color ?? "#8b6cff")}55` } : undefined}
    >
      {label}
    </button>
  );
}

// ─────────────────────────── Выплаты ───────────────────────────

function Methods() {
  const c = useStore((s) => s.config);
  return (
    <Section
      title="Способы выплаты"
      text="Комиссия вычитается из начисленного. Способ по умолчанию ставится новым сотрудникам."
      action={
        <Button size="sm" onClick={() => upd((x) => void x.methods.push({ id: uid(), name: "Новый способ", commissionPct: 0 }))}>
          <Plus size={15} /> Способ
        </Button>
      }
    >
      <div className="space-y-2">
        {c.methods.map((m, i) => (
          <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
            <Text value={m.name} onCommit={(v) => upd((x) => void (x.methods[i].name = v))} className="w-56" />
            <Num value={m.commissionPct} onCommit={(v) => upd((x) => void (x.methods[i].commissionPct = v ?? 0))} className="w-24" />
            <span className="text-xs text-muted">% комиссии</span>
            <label className="ml-4 flex cursor-pointer items-center gap-2 text-sm text-fg-2">
              <input
                type="radio"
                checked={c.rules.defaultMethodId === m.id}
                onChange={() => upd((x) => void (x.rules.defaultMethodId = m.id))}
                className="accent-[#8b6cff]"
              />
              по умолчанию
            </label>
            <div className="ml-auto">
              <IconBtn danger disabled={c.methods.length < 2} onClick={() => upd((x) => void x.methods.splice(i, 1))}>
                <Trash2 size={14} />
              </IconBtn>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─────────────────────────── Данные ───────────────────────────

function Data() {
  const demo = useStore((s) => s.demo);
  const archiveLen = useStore((s) => s.archive.length);
  const [pending, setPending] = useState<Pending | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cfgRef = useRef<HTMLInputElement>(null);
  const setUi = useUi((s) => s.set);

  const exportConfig = () => {
    const config = useStore.getState().config;
    const blob = new Blob([JSON.stringify({ type: "payout-config", version: SCHEMA_VERSION, config }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payout-настройки-${config.short}.json`;
    a.click();
    toast.success("Файл настроек скачан");
  };
  const importConfig = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      const cfg = data?.config ?? (data?.departments ? data : undefined);
      if (!cfg?.departments) throw new Error();
      useStore.getState().replaceConfig(migrateWorkspace({ config: cfg }).config!);
      toast.success("Настройки применены");
    } catch {
      toast.error("В файле нет настроек Payout");
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(exportWorkspace(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payout-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    toast.success("Резервная копия скачана");
  };
  const importJson = async (f: File) => {
    try {
      const ws = JSON.parse(await f.text()) as Workspace;
      if (!ws.config || !Array.isArray(ws.employees) || !ws.current) throw new Error();
      useStore.getState().importWorkspace(ws);
      toast.success("Данные загружены");
    } catch {
      toast.error("Это не резервная копия Payout");
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Section title="Резервная копия" text="Пока данные хранятся в этом браузере. Сохраняйте копию — так их можно перенести на другой компьютер.">
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportJson}>
            <Download size={15} /> Скачать копию .json
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Загрузить из файла
          </Button>
          <input ref={fileRef} type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
        </div>
      </Section>
      <Section
        title="Настройки как шаблон"
        text="Только правила: отделы, должности, действия, тарифы — без сотрудников и выплат. Удобно поделиться с другой фракцией или перенести правила."
      >
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportConfig}>
            <Download size={15} /> Скачать настройки
          </Button>
          <Button onClick={() => cfgRef.current?.click()}>
            <Upload size={15} /> Применить настройки из файла
          </Button>
          <input ref={cfgRef} type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && importConfig(e.target.files[0])} />
        </div>
        <p className="mt-3 text-xs text-muted">
          При применении сотрудники остаются; если их отдела или должности нет в новых настройках — подбирается совпадающая по названию.
        </p>
      </Section>
      <Section title="Новая организация" text="Пошаговый мастер: модель расчёта, название, отделы и должности, импорт сотрудников. Текущие данные будут заменены.">
        <Button variant="primary" onClick={() => setUi({ wizard: true })}>
          <Building2 size={16} /> Создать организацию
        </Button>
      </Section>
      <Section title="Начать с чистого листа" text="Удалит настройки, сотрудников, неделю и архив в этом браузере и вернёт экран приветствия. Сначала сохраните копию.">
        <Button variant="danger" onClick={() => setPending({ title: "Удалить все данные?", load: async () => emptyWorkspace() })}>
          <Trash2 size={15} /> Удалить все данные
        </Button>
      </Section>
      {import.meta.env.DEV && <DevDemos onPick={setPending} demo={!!demo} archiveLen={archiveLen} />}
      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending?.title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Отмена
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const ws = await pending!.load();
                useStore.getState().loadWorkspace(ws);
                setPending(null);
                toast.success("Готово");
                go({ name: "overview" });
              }}
            >
              Заменить
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">Текущие настройки, сотрудники, неделя и архив будут удалены без возможности восстановления (если нет резервной копии).</p>
      </Modal>
    </div>
  );
}

type Pending = { title: string; load: () => Promise<Workspace> };

/** Демо-наборы — только в режиме разработки, в продакшен-сборку не попадают. */
function DevDemos({ onPick, demo, archiveLen }: { onPick: (p: Pending) => void; demo: boolean; archiveLen: number }) {
  const [list, setList] = useState<{ id: string; name: string; description: string }[]>([]);
  useEffect(() => {
    import("@/dev/demo").then((m) => setList(m.DEMOS));
  }, []);
  return (
    <Section title="Демо-данные · dev" text="Видно только при разработке. Выдуманные сотрудники, количества действий — из реальной недели WPS.">
      <div className="space-y-2">
        {list.map((t) => (
          <button
            key={t.id}
            onClick={() =>
              onPick({
                title: `Загрузить демо «${t.name}»?`,
                load: async () => (await import("@/dev/demo")).buildDemo(t.id as "lspd" | "saspa"),
              })
            }
            className="flex w-full cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition hover:border-accent/40 hover:bg-accent/[0.05]"
          >
            <RotateCcw size={16} className="mt-0.5 text-muted" />
            <div>
              <div className="text-sm font-medium">{t.name}</div>
              <div className="text-xs text-muted">{t.description}</div>
            </div>
          </button>
        ))}
      </div>
      {demo && archiveLen > 0 && (
        <button
          className="mt-3 cursor-pointer text-xs text-warn underline underline-offset-2"
          onClick={() => {
            useStore.setState({ archive: [], demo: false });
            toast.success("Демо-архив очищен");
          }}
        >
          Очистить демо-архив ({archiveLen} нед.)
        </button>
      )}
    </Section>
  );
}
