import { Command } from "cmdk";
import {
  Archive,
  Building2,
  Calculator,
  ChevronRight,
  FileSpreadsheet,
  LayoutDashboard,
  Lock,
  Redo2,
  Search,
  Settings,
  Undo2,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { useCurrentCalc } from "@/hooks";
import { cn, money, period } from "@/lib/format";
import { go, href, type Route } from "@/lib/router";
import { useStore } from "@/store";
import { useUi } from "@/uiStore";
import { downloadCurrentReport } from "@/export/report";
import { Kbd, Progress } from "./ui";

const NAV: { route: Route; label: string; icon: ReactNode; key: string }[] = [
  { route: { name: "overview" }, label: "Обзор", icon: <LayoutDashboard size={17} />, key: "1" },
  { route: { name: "week" }, label: "Ввод недели", icon: <Calculator size={17} />, key: "2" },
  { route: { name: "payouts" }, label: "Ведомость", icon: <Wallet size={17} />, key: "3" },
  { route: { name: "archive" }, label: "Архив", icon: <Archive size={17} />, key: "4" },
  { route: { name: "employees" }, label: "Сотрудники", icon: <Users size={17} />, key: "5" },
  { route: { name: "settings" }, label: "Настройки", icon: <Settings size={17} />, key: "6" },
];

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const config = useStore((s) => s.config);
  const start = useStore((s) => s.current.start);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const { undo, redo } = useStore.getState();
  const calc = useCurrentCalc();
  const ui = useUi();

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const typing = (e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable]");
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ui.set({ palette: !useUi.getState().palette });
      } else if (mod && !typing && e.code === "KeyZ") {
        e.preventDefault();
        if (e.shiftKey) useStore.getState().redo();
        else useStore.getState().undo();
      } else if (mod && !typing && e.code === "KeyY") {
        e.preventDefault();
        useStore.getState().redo();
      } else if (e.altKey && /^[1-6]$/.test(e.key)) {
        e.preventDefault();
        go(NAV[Number(e.key) - 1].route);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [ui]);

  const paidShare = calc.totals.members ? calc.totals.paidCount / calc.totals.members : 0;

  return (
    <div className="relative flex h-full">
      <div className="aurora" />

      {/* Sidebar */}
      <aside className="relative z-10 hidden w-[248px] shrink-0 flex-col border-r border-white/[0.06] bg-ink-950/40 px-3 py-4 backdrop-blur-xl md:flex">
        <a href={href({ name: "overview" })} className="flex items-center gap-2.5 px-2 pb-5">
          <div className="grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-[#9a7dff] to-[#22d3ee] shadow-[0_6px_20px_-6px_rgb(139_108_255/0.8)]">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
              <path d="M9 24V8h8a5 5 0 0 1 0 10H9" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight">Payout</div>
            <div className="text-[11px] text-muted">учёт премий</div>
          </div>
        </a>

        <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
          <div className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded-lg bg-white/[0.06] text-[10px] font-bold tracking-wide">
              {config.short.slice(0, 4)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium">{config.short}</div>
              <div className="truncate text-[11px] text-muted">{config.name}</div>
            </div>
          </div>
        </div>

        <nav className="space-y-0.5">
          {NAV.map((n) => {
            const active = n.route.name === route.name;
            return (
              <a
                key={n.route.name}
                href={href(n.route)}
                className={cn(
                  "group relative flex h-9 items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium transition-colors",
                  active ? "text-fg" : "text-muted hover:text-fg-2 hover:bg-white/[0.03]",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl bg-white/[0.07] shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                  />
                )}
                {active && (
                  <motion.span
                    layoutId="nav-bar"
                    className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r-full bg-gradient-to-b from-accent to-accent-2"
                  />
                )}
                <span className="relative">{n.icon}</span>
                <span className="relative flex-1">{n.label}</span>
                <span className="relative opacity-0 transition-opacity group-hover:opacity-100">
                  <Kbd>Alt {n.key}</Kbd>
                </span>
              </a>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <button
            onClick={() => go({ name: "payouts" })}
            className="w-full cursor-pointer rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-3 text-left transition hover:border-white/[0.12]"
          >
            <div className="flex items-center justify-between text-[11px] text-muted">
              <span>Текущая неделя</span>
              <span className="flex items-center gap-1 text-good">
                <span className="size-1.5 animate-pulse rounded-full bg-good" /> открыта
              </span>
            </div>
            <div className="mt-1 text-[13px] font-medium">{period(start)}</div>
            <div className="num mt-2 flex items-baseline justify-between text-xs">
              <span className="text-fg-2">{money(calc.totals.net)}</span>
              <span className="text-muted">
                {calc.totals.paidCount}/{calc.totals.members} выдано
              </span>
            </div>
            <Progress value={paidShare} className="mt-2" />
          </button>
          <button
            onClick={() => ui.set({ palette: true })}
            className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-[13px] text-muted transition hover:text-fg-2"
          >
            <Search size={15} /> Поиск и команды
            <span className="ml-auto">
              <Kbd>Ctrl K</Kbd>
            </span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/[0.05] px-4 md:px-8">
          <div className="flex items-center gap-1.5 text-[13px] text-muted">
            <span className="md:hidden font-semibold text-fg">Payout</span>
            <span className="hidden md:inline">{config.short}</span>
            <ChevronRight size={14} className="hidden md:inline" />
            <span className="text-fg-2">{NAV.find((n) => n.route.name === route.name)?.label}</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              title="Отменить (Ctrl+Z)"
              disabled={!canUndo}
              onClick={undo}
              className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-fg disabled:opacity-30 disabled:pointer-events-none"
            >
              <Undo2 size={16} />
            </button>
            <button
              title="Повторить (Ctrl+Shift+Z)"
              disabled={!canRedo}
              onClick={redo}
              className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-fg disabled:opacity-30 disabled:pointer-events-none"
            >
              <Redo2 size={16} />
            </button>
            <button
              onClick={() => ui.set({ palette: true })}
              className="ml-1 grid size-8 cursor-pointer place-items-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-fg md:hidden"
            >
              <Search size={16} />
            </button>
          </div>
        </header>

        {/* Мобильная навигация */}
        <nav className="flex gap-1 overflow-x-auto border-b border-white/[0.05] px-3 py-2 md:hidden">
          {NAV.map((n) => (
            <a
              key={n.route.name}
              href={href(n.route)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs",
                n.route.name === route.name ? "bg-white/[0.08] text-fg" : "text-muted",
              )}
            >
              {n.icon}
              {n.label}
            </a>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={route.name + ("id" in route ? route.id ?? "" : "")}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8 md:py-8"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <Palette />
    </div>
  );
}

function Palette() {
  const open = useUi((s) => s.palette);
  const set = useUi((s) => s.set);
  const employees = useStore((s) => s.employees);
  const departments = useStore((s) => s.config.departments);
  const close = () => set({ palette: false });
  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[14vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
          <motion.div
            initial={{ y: 12, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 8, scale: 0.98 }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
            className="relative w-full max-w-[600px] overflow-hidden rounded-2xl border border-white/10 bg-ink-850/95 shadow-2xl shadow-black/60"
          >
            <Command
              loop
              onKeyDown={(e) => e.key === "Escape" && close()}
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted"
            >
              <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
                <Search size={17} className="text-muted" />
                <Command.Input
                  autoFocus
                  placeholder="Сотрудник, страница или команда…"
                  className="h-13 flex-1 bg-transparent py-4 text-[15px] outline-none placeholder:text-faint"
                />
                <Kbd>Esc</Kbd>
              </div>
              <Command.List className="max-h-[52vh] overflow-auto p-2">
                <Command.Empty className="py-10 text-center text-sm text-muted">Ничего не найдено</Command.Empty>
                <Command.Group heading="Действия">
                  <Item icon={<FileSpreadsheet size={16} />} onSelect={run(() => downloadCurrentReport().then(() => toast.success("Отчёт .xlsx скачан")))}>
                    Скачать отчёт для админов (.xlsx)
                  </Item>
                  <Item icon={<Lock size={16} />} onSelect={run(() => set({ closeWeek: true }))}>
                    Закрыть неделю
                  </Item>
                  <Item icon={<UserPlus size={16} />} onSelect={run(() => set({ employeeForm: {} }))}>
                    Добавить сотрудника
                  </Item>
                  <Item icon={<Building2 size={16} />} onSelect={run(() => set({ wizard: true }))}>
                    Новая организация
                  </Item>
                </Command.Group>
                <Command.Group heading="Перейти">
                  {NAV.map((n) => (
                    <Item key={n.route.name} icon={n.icon} onSelect={run(() => go(n.route))} hint={`Alt ${n.key}`}>
                      {n.label}
                    </Item>
                  ))}
                </Command.Group>
                <Command.Group heading="Сотрудники">
                  {employees.map((e) => {
                    const d = departments.find((x) => x.id === e.deptId);
                    return (
                      <Item
                        key={e.id}
                        value={`${e.name} ${e.passport} ${d?.name ?? ""}`}
                        icon={<span className="size-2 rounded-full" style={{ background: d?.color }} />}
                        onSelect={run(() => go({ name: "employees", id: e.id }))}
                        hint={d?.name}
                      >
                        {e.name}
                        <span className="ml-2 font-mono text-[11px] text-faint">{e.passport}</span>
                      </Item>
                    );
                  })}
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Item({
  children,
  icon,
  onSelect,
  hint,
  value,
}: {
  children: ReactNode;
  icon: ReactNode;
  onSelect: () => void;
  hint?: string;
  value?: string;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex h-10 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm text-fg-2 data-[selected=true]:bg-white/[0.07] data-[selected=true]:text-fg"
    >
      <span className="grid w-4 place-items-center text-muted">{icon}</span>
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </Command.Item>
  );
}
