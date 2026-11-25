import { Archive, Building2, Calculator, FileSpreadsheet, FlaskConical, Upload, Wallet } from "lucide-react";
import { motion } from "motion/react";
import { useRef } from "react";
import { toast } from "sonner";
import type { Workspace } from "@/data/templates";
import { useStore } from "@/store";
import { useUi } from "@/uiStore";
import { Button } from "./ui";

/** Первый запуск: организации ещё нет. */
export function Welcome() {
  const setUi = useUi((s) => s.set);
  const fileRef = useRef<HTMLInputElement>(null);

  const restore = async (f: File) => {
    try {
      const ws = JSON.parse(await f.text()) as Workspace;
      if (!ws.config || !Array.isArray(ws.employees) || !ws.current) throw new Error();
      useStore.getState().importWorkspace({ ...ws, onboarded: true });
      toast.success("Данные восстановлены");
    } catch {
      toast.error("Это не резервная копия Payout");
    }
  };

  const loadDemo = async (id: "lspd" | "saspa") => {
    const m = await import("@/dev/demo");
    useStore.getState().loadWorkspace(m.buildDemo(id));
  };

  const features = [
    { icon: <Calculator size={18} />, title: "Быстрый ввод", text: "Таблица как в Excel, но с клавиатуры и с мгновенным расчётом" },
    { icon: <Wallet size={18} />, title: "Ведомость", text: "Выдача в один клик, комиссия, контроль изменений после выдачи" },
    { icon: <Archive size={18} />, title: "Архив и статистика", text: "Закрытие недели одной кнопкой, история и топы" },
    { icon: <FileSpreadsheet size={18} />, title: "Отчёт для админов", text: ".xlsx с формулами — открывается в WPS, Excel и Google" },
  ];

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-auto px-4 py-12">
      <div className="aurora" />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-[760px] text-center"
      >
        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-[#9a7dff] to-[#22d3ee] shadow-[0_12px_40px_-10px_rgb(139_108_255/0.9)]">
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
            <path d="M9 24V8h8a5 5 0 0 1 0 10H9" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-[40px] font-semibold leading-tight tracking-tight md:text-[52px]">
          <span className="text-gradient">Payout</span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] text-fg-2">
          Учёт и выдача премий для фракций и организаций. Ваши отделы, ваши правила — баллы, бюджеты или ставки.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button variant="primary" size="lg" onClick={() => setUi({ wizard: true })}>
            <Building2 size={17} /> Создать организацию
          </Button>
          <Button size="lg" onClick={() => fileRef.current?.click()}>
            <Upload size={17} /> Восстановить из копии
          </Button>
          <input ref={fileRef} type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
        </div>

        <div className="mt-12 grid gap-3 text-left sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="glass rounded-2xl p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="text-accent-2">{f.icon}</span>
                {f.title}
              </div>
              <div className="mt-1 text-[13px] text-muted">{f.text}</div>
            </div>
          ))}
        </div>

        {import.meta.env.DEV && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
            <FlaskConical size={14} /> dev:
            <button className="cursor-pointer underline underline-offset-2 hover:text-fg" onClick={() => loadDemo("lspd")}>
              демо LSPD
            </button>
            <button className="cursor-pointer underline underline-offset-2 hover:text-fg" onClick={() => loadDemo("saspa")}>
              демо SASPA
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
