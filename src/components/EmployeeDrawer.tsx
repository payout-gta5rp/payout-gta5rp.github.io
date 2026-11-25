import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Eraser, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentCalc } from "@/hooks";
import { cn, money } from "@/lib/format";
import { useStore } from "@/store";
import { Avatar, Badge, Button, Input, Segmented } from "./ui";

export function EmployeeDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {id && (
        <motion.div className="fixed inset-0 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
          <motion.aside
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.1, duration: 0.4 }}
            className="absolute right-0 top-0 flex h-full w-full max-w-[420px] flex-col border-l border-white/10 bg-ink-900/95 shadow-2xl backdrop-blur-xl"
          >
            <DrawerBody id={id} onClose={onClose} />
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DrawerBody({ id, onClose }: { id: string; onClose: () => void }) {
  const emp = useStore((s) => s.employees.find((e) => e.id === id));
  const config = useStore((s) => s.config);
  const entry = useStore((s) => s.current.entries[id]);
  const st = useStore.getState();
  const calc = useCurrentCalc();
  const line = calc.lines[id];
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  if (!emp) return null;
  const dept = config.departments.find((d) => d.id === emp.deptId);
  const pos = config.positions.find((p) => p.id === emp.positionId);
  const cur = config.rules.currency;

  const addAdj = () => {
    const n = Number(amount.replace(/\s/g, ""));
    if (!n) return;
    st.addAdjustment(id, { amount: n, reason: reason.trim() || "Без комментария" });
    setAmount("");
    setReason("");
  };

  return (
    <>
      <div className="flex items-start gap-3 border-b border-white/[0.06] p-5">
        <Avatar name={emp.name} color={dept?.color} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-semibold">{emp.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge color={dept?.color}>{dept?.name}</Badge>
            <Badge>{pos?.name}</Badge>
          </div>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(emp.passport);
              toast.success("Паспорт скопирован");
            }}
            className="mt-2 inline-flex cursor-pointer items-center gap-1.5 font-mono text-xs text-muted hover:text-fg"
          >
            паспорт {emp.passport || "—"} <Copy size={12} />
          </button>
        </div>
        <button onClick={onClose} className="cursor-pointer rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-fg">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-auto p-5">
        {/* Как посчитано */}
        <section>
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Как посчитано</div>
          {!line ? (
            <div className="text-sm text-muted">Сотрудник не участвует в премии.</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/[0.07]">
              {line.steps.map((s, i) => {
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
                    <div className={cn("num font-mono", last ? "text-[15px] font-semibold text-fg" : "text-fg-2", s.value < 0 && "text-bad")}>
                      {s.label === "Баллы" ? s.value : money(s.value)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {line?.capped && (
            <div className="mt-2 text-xs text-warn">Сумма упёрлась в недельный лимит.</div>
          )}
        </section>

        {/* Выплата */}
        <section>
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Выплата</div>
          <div className="space-y-3">
            <Segmented
              value={line?.methodId ?? config.rules.defaultMethodId}
              onChange={(v) => st.setMethod(id, v)}
              options={config.methods.map((m) => ({
                value: m.id,
                label: m.commissionPct ? `${m.name} · ${m.commissionPct}%` : m.name,
              }))}
            />
            <Button
              variant={entry?.paid ? "good" : "primary"}
              className="w-full"
              disabled={!line || line.gross <= 0}
              onClick={() => st.setPaid([id], !entry?.paid)}
            >
              {entry?.paid ? (
                <>
                  <Check size={16} /> Выдано · {money(line?.net ?? 0, cur)}
                </>
              ) : (
                <>Отметить выдачу · {money(line?.net ?? 0, cur)}</>
              )}
            </Button>
          </div>
        </section>

        {/* Корректировки */}
        <section>
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Бонусы и штрафы</div>
          <div className="space-y-1.5">
            {(entry?.adjustments ?? []).map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                <span className={cn("num font-mono font-medium", a.amount > 0 ? "text-good" : "text-bad")}>
                  {a.amount > 0 ? "+" : ""}
                  {money(a.amount)}
                </span>
                <span className="flex-1 truncate text-fg-2">{a.reason}</span>
                <button
                  onClick={() => st.removeAdjustment(id, a.id)}
                  className="cursor-pointer rounded-md p-1 text-muted hover:bg-white/5 hover:text-bad"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              placeholder="±сумма"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-28 font-mono"
              onKeyDown={(e) => e.key === "Enter" && addAdj()}
            />
            <Input
              placeholder="Причина"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addAdj()}
            />
            <Button onClick={addAdj} className="shrink-0 px-2.5">
              <Plus size={16} />
            </Button>
          </div>
        </section>

        {/* Примечание */}
        <section>
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Примечание</div>
          <textarea
            defaultValue={entry?.note ?? ""}
            onBlur={(e) => st.setNote(id, e.target.value)}
            rows={3}
            placeholder="Видно в ведомости и в отчёте"
            className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] p-3 text-sm outline-none placeholder:text-faint focus:border-accent/60 focus:ring-4 focus:ring-accent/15"
          />
        </section>
      </div>

      <div className="border-t border-white/[0.06] p-4">
        <Button variant="ghost" className="w-full text-muted" onClick={() => st.clearEmployeeWeek(id)}>
          <Eraser size={15} /> Очистить данные недели сотрудника
        </Button>
      </div>
    </>
  );
}
