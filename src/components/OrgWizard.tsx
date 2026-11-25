import { ArrowLeft, ArrowRight, Building2, Check, FileJson, Plus, Sparkles, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { blankConfig, LSPD_CONFIG, SASPA_CONFIG } from "@/data/templates";
import { migrateWorkspace } from "@/data/migrate";
import type { BaseMode, OrgConfig } from "@/engine/types";
import { modeName } from "@/export/report";
import { cn } from "@/lib/format";
import { go } from "@/lib/router";
import { uid, useStore } from "@/store";
import { useUi } from "@/uiStore";
import { EmployeeImport, type ImportPlan } from "./EmployeeImport";
import { Button, Field, Input, Select } from "./ui";

type Step = 0 | 1 | 2 | 3;
const STEPS = ["Шаблон", "Организация", "Отделы и должности", "Сотрудники"];
const PALETTE = ["#b8860b", "#4f8cff", "#14a58a", "#9466f5", "#ef5350", "#c34fcb", "#6f9a1f"];

const TPL: { id: string; title: string; text: string; config: () => OrgConfig }[] = [
  {
    id: "lspd",
    title: "Баллы за действия",
    text: "Как LSPD: каталог действий с баллами, цена балла, множители должностей, недельный лимит, комиссия.",
    config: () => structuredClone(LSPD_CONFIG),
  },
  {
    id: "saspa",
    title: "Бюджет и доли",
    text: "Как SASPA: офис на ставках, остаток бюджета делится по весам отделов и % вклада.",
    config: () => structuredClone(SASPA_CONFIG),
  },
  {
    id: "blank",
    title: "С нуля",
    text: "Один отдел и одна должность — всё остальное настроите сами.",
    config: blankConfig,
  },
];

export function OrgWizard() {
  const open = useUi((s) => s.wizard);
  const setUi = useUi((s) => s.set);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 overflow-auto bg-ink-950/90 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="aurora" />
          <Body onClose={() => setUi({ wizard: false })} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Body({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>(0);
  const [tpl, setTpl] = useState<string>("lspd");
  const [config, setConfig] = useState<OrgConfig>(() => ({ ...TPL[0].config(), name: "", short: "" }));
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const edit = (fn: (c: OrgConfig) => void) =>
    setConfig((c) => {
      const n = structuredClone(c);
      fn(n);
      return n;
    });

  const pick = (id: string) => {
    setTpl(id);
    const t = TPL.find((x) => x.id === id);
    if (t) {
      const c = t.config();
      c.name = "";
      c.short = "";
      setConfig(c);
    }
  };

  const loadFile = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      const cfg: OrgConfig | undefined = data?.config ?? (data?.departments ? data : undefined);
      if (!cfg?.departments) throw new Error();
      setConfig(migrateWorkspace({ config: cfg }).config!);
      setTpl("file");
      toast.success("Настройки загружены из файла");
    } catch {
      toast.error("В файле нет настроек Payout");
    }
  };

  const finish = () => {
    const c = structuredClone(config);
    c.name = c.name.trim() || "Моя организация";
    c.short = c.short.trim() || c.name.slice(0, 5).toUpperCase();
    c.departments.forEach((d, i) => (d.name = d.name.trim() || `Отдел ${i + 1}`));
    c.positions.forEach((p, i) => (p.name = p.name.trim() || `Должность ${i + 1}`));
    if (plan) {
      c.departments.push(...plan.newDepartments);
      c.positions.push(...plan.newPositions);
    }
    const employees = (plan?.employees ?? []).map((e) => ({ ...e, id: uid() }));
    useStore.getState().startOrganization(c, employees);
    onClose();
    toast.success(`${c.short} готова к работе`, { description: employees.length ? `Сотрудников: ${employees.length}` : "Добавьте сотрудников" });
    go({ name: employees.length ? "week" : "employees" });
  };

  const canNext = step !== 1 || config.name.trim().length > 0;

  return (
    <div className="relative mx-auto flex min-h-full max-w-[920px] flex-col px-4 py-8 md:py-12">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-[#9a7dff] to-[#22d3ee]">
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <div className="text-lg font-semibold">Новая организация</div>
            <div className="text-xs text-muted">Текущие данные будут заменены — сохраните резервную копию, если нужно</div>
          </div>
        </div>
        <button onClick={onClose} className="cursor-pointer rounded-lg p-2 text-muted hover:bg-white/5 hover:text-fg">
          <X size={20} />
        </button>
      </div>

      {/* Шаги */}
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition",
                i < step ? "bg-good/20 text-good" : i === step ? "bg-accent text-white shadow-glow" : "bg-white/[0.06] text-muted",
              )}
            >
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            <span className={cn("hidden text-[13px] sm:inline", i === step ? "text-fg" : "text-muted")}>{s}</span>
            {i < STEPS.length - 1 && <div className={cn("h-px flex-1", i < step ? "bg-good/40" : "bg-white/[0.08]")} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.2 }}
          className="flex-1"
        >
          {step === 0 && (
            <div>
              <h2 className="mb-1 text-2xl font-semibold tracking-tight">Как у вас считаются премии?</h2>
              <p className="mb-6 text-sm text-muted">Выберите основу — дальше всё можно поменять. Модели можно смешивать: у каждого отдела своя.</p>
              <div className="grid gap-3 md:grid-cols-3">
                {TPL.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => pick(t.id)}
                    className={cn(
                      "glass cursor-pointer rounded-2xl p-5 text-left transition hover:-translate-y-0.5",
                      tpl === t.id && "!border-accent/60 shadow-glow",
                    )}
                  >
                    <Sparkles size={18} className={tpl === t.id ? "text-accent" : "text-muted"} />
                    <div className="mt-3 font-semibold">{t.title}</div>
                    <div className="mt-1 text-[13px] text-muted">{t.text}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "mt-3 flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-white/15 p-4 text-left text-sm transition hover:border-accent/50",
                  tpl === "file" && "border-accent/60",
                )}
              >
                <FileJson size={18} className="text-accent-2" />
                <span>
                  <span className="font-medium">Загрузить настройки из файла</span>
                  <span className="block text-xs text-muted">Файл настроек другой организации или резервная копия Payout (.json)</span>
                </span>
              </button>
              <input ref={fileRef} type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
            </div>
          )}

          {step === 1 && (
            <div className="max-w-xl">
              <h2 className="mb-6 text-2xl font-semibold tracking-tight">Как называется организация?</h2>
              <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <Field label="Полное название">
                  <Input autoFocus value={config.name} onChange={(e) => edit((c) => void (c.name = e.target.value))} placeholder="Los Santos Police Department" />
                </Field>
                <Field label="Коротко">
                  <Input value={config.short} onChange={(e) => edit((c) => void (c.short = e.target.value))} placeholder="LSPD" />
                </Field>
                <Field label="Валюта">
                  <Input value={config.rules.currency} onChange={(e) => edit((c) => void (c.rules.currency = e.target.value))} />
                </Field>
                {config.departments.some((d) => d.mode === "points") && (
                  <Field label="Цена балла">
                    <Input
                      value={String(config.rules.pointPrice)}
                      inputMode="numeric"
                      onChange={(e) => edit((c) => void (c.rules.pointPrice = Number(e.target.value.replace(/\D/g, "")) || 0))}
                    />
                  </Field>
                )}
                {config.departments.some((d) => d.mode !== "points") && (
                  <Field label="Недельный бюджет">
                    <Input
                      value={String(config.rules.budget)}
                      inputMode="numeric"
                      onChange={(e) => edit((c) => void (c.rules.budget = Number(e.target.value.replace(/\D/g, "")) || 0))}
                    />
                  </Field>
                )}
                <Field label="Лимит на человека в неделю" hint="Пусто — без лимита">
                  <Input
                    value={config.rules.weeklyCap == null ? "" : String(config.rules.weeklyCap)}
                    inputMode="numeric"
                    placeholder="без лимита"
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "");
                      edit((c) => void (c.rules.weeklyCap = v ? Number(v) : null));
                    }}
                  />
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-8">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">Отделы</h3>
                  <Button
                    size="sm"
                    onClick={() =>
                      edit((c) => void c.departments.push({ id: uid(), name: "", color: PALETTE[c.departments.length % PALETTE.length], mode: c.departments[0]?.mode ?? "points" }))
                    }
                  >
                    <Plus size={14} /> Отдел
                  </Button>
                </div>
                <div className="space-y-2">
                  {config.departments.map((d, i) => (
                    <div key={d.id} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
                      <input type="color" value={d.color} onChange={(e) => edit((c) => void (c.departments[i].color = e.target.value))} className="size-8 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0" />
                      <Input
                        value={d.name}
                        placeholder="Название"
                        className="min-w-[140px] flex-1"
                        onChange={(e) => edit((c) => void (c.departments[i].name = e.target.value))}
                      />
                      <Select
                        className="w-44 shrink-0"
                        value={d.mode}
                        onChange={(v) => edit((c) => void (c.departments[i].mode = v as BaseMode))}
                        options={(["points", "budgetShare", "fixed", "manual"] as BaseMode[]).map((m) => ({ value: m, label: modeName(m) }))}
                      />
                      {d.mode === "budgetShare" && (
                        <Input
                          className="w-16 shrink-0 font-mono"
                          value={String(d.weight ?? 0)}
                          onChange={(e) => edit((c) => void (c.departments[i].weight = Number(e.target.value) || 0))}
                          title="Вес, %"
                        />
                      )}
                      <button
                        disabled={config.departments.length < 2}
                        onClick={() => edit((c) => void c.departments.splice(i, 1))}
                        className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted hover:bg-bad/10 hover:text-bad disabled:opacity-25"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">Должности</h3>
                  <Button size="sm" onClick={() => edit((c) => void c.positions.push({ id: uid(), name: "", multiplier: 100 }))}>
                    <Plus size={14} /> Должность
                  </Button>
                </div>
                <div className="space-y-2">
                  {config.positions.map((p, i) => (
                    <div key={p.id} className="grid grid-cols-[1fr_80px_32px] items-center gap-2 sm:max-w-[60%]">
                      <Input value={p.name} placeholder="Название" onChange={(e) => edit((c) => void (c.positions[i].name = e.target.value))} />
                      <Input
                        className="w-20 shrink-0 font-mono"
                        value={String(p.multiplier)}
                        title="Множитель, %"
                        onChange={(e) => edit((c) => void (c.positions[i].multiplier = Number(e.target.value) || 0))}
                      />
                      <button
                        disabled={config.positions.length < 2}
                        onClick={() => edit((c) => void c.positions.splice(i, 1))}
                        className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted hover:bg-bad/10 hover:text-bad disabled:opacity-25"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted">Множитель в процентах: 100 = ×1, 130 = ×1.3. Действия и тонкие правила — потом в «Настройках».</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="mb-1 text-2xl font-semibold tracking-tight">Добавим сотрудников</h2>
              <p className="mb-5 text-sm text-muted">Вставьте список из старой таблицы — или пропустите шаг и добавьте людей позже.</p>
              <EmployeeImport config={config} existing={[]} onPlan={setPlan} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-10 flex items-center justify-between border-t border-white/[0.06] pt-5">
        <Button variant="ghost" onClick={() => (step ? setStep((step - 1) as Step) : onClose())}>
          <ArrowLeft size={16} /> {step ? "Назад" : "Отмена"}
        </Button>
        {step < 3 ? (
          <Button variant="primary" size="lg" disabled={!canNext} onClick={() => setStep((step + 1) as Step)}>
            Дальше <ArrowRight size={16} />
          </Button>
        ) : (
          <Button variant="primary" size="lg" onClick={finish}>
            <Check size={17} /> Создать {plan ? `· ${plan.employees.length} сотр.` : ""}
          </Button>
        )}
      </div>
    </div>
  );
}
