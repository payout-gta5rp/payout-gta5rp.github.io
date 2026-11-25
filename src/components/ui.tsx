import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { cn, initials } from "@/lib/format";

/** Если в className задана ширина (w-*, flex-1, min-w-*) — не ставим w-full, чтобы не перебить её. */
const hasWidth = (c?: string) => !!c && /(^|\s)(w-|flex-1)/.test(c);

type Variant = "primary" | "ghost" | "soft" | "danger" | "good";

export function Button({
  variant = "soft",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 select-none",
        "disabled:opacity-40 disabled:pointer-events-none active:scale-[0.97] cursor-pointer whitespace-nowrap",
        size === "sm" && "h-8 px-3 text-[13px]",
        size === "md" && "h-9 px-3.5 text-sm",
        size === "lg" && "h-11 px-5 text-[15px]",
        variant === "primary" &&
          "text-white bg-gradient-to-b from-[#9a7dff] to-[#7253f5] shadow-[0_1px_0_0_rgb(255_255_255/0.25)_inset,0_8px_24px_-8px_rgb(139_108_255/0.7)] hover:brightness-110",
        variant === "soft" && "bg-white/[0.06] text-fg hover:bg-white/[0.1] border border-white/[0.06]",
        variant === "ghost" && "text-fg-2 hover:text-fg hover:bg-white/[0.06]",
        variant === "danger" && "bg-bad/10 text-bad hover:bg-bad/20 border border-bad/20",
        variant === "good" && "bg-good/12 text-good hover:bg-good/20 border border-good/25",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("glass rounded-2xl", className)}>{children}</div>;
}

export function Badge({ color, children, className }: { color?: string; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", className)}
      style={
        color
          ? { background: color + "1f", color, boxShadow: `inset 0 0 0 1px ${color}33` }
          : { background: "rgb(255 255 255 / 0.06)", color: "var(--color-fg-2)" }
      }
    >
      {children}
    </span>
  );
}

export function Dot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2 rounded-full shrink-0", className)}
      style={{ background: color, boxShadow: `0 0 10px ${color}aa` }}
    />
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cn(
        "h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 text-sm text-fg placeholder:text-faint",
        !hasWidth(className) && "w-full",
        "outline-none focus:border-accent/60 focus:bg-white/[0.06] focus:ring-4 focus:ring-accent/15 transition",
        className,
      )}
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] px-2.5 text-sm text-fg outline-none",
        !hasWidth(className) && "w-full",
        "focus:border-accent/60 focus:ring-4 focus:ring-accent/15 transition cursor-pointer",
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-ink-850">
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-xl bg-white/[0.04] border border-white/[0.07] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative rounded-[10px] font-medium transition-colors cursor-pointer whitespace-nowrap",
            size === "sm" ? "px-2.5 h-7 text-xs" : "px-3 h-8 text-[13px]",
            value === o.value ? "text-fg" : "text-muted hover:text-fg-2",
          )}
        >
          {value === o.value && (
            <motion.span
              layoutId={undefined}
              className="absolute inset-0 rounded-[10px] bg-white/[0.09] shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
              transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
            />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-white/10 bg-white/[0.05] px-1 font-mono text-[10px] text-muted">
      {children}
    </kbd>
  );
}

export function Avatar({ name, color, size = 28 }: { name: string; color?: string; size?: number }) {
  const c = color ?? "#8b6cff";
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, ${c}55, ${c}22)`,
        color: c,
        boxShadow: `inset 0 0 0 1px ${c}44`,
      }}
    >
      {initials(name)}
    </span>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("h-1.5 rounded-full bg-white/[0.06] overflow-hidden", className)}>
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-accent via-accent-2 to-good"
        initial={false}
        animate={{ width: `${v * 100}%` }}
        transition={{ type: "spring", bounce: 0, duration: 0.6 }}
      />
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            className="relative w-full rounded-2xl border border-white/10 bg-ink-850/95 shadow-2xl shadow-black/60"
            style={{ maxWidth: width }}
            initial={{ y: 16, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 8, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <div className="text-[15px] font-semibold">{title}</div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-fg cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="px-5 pb-5">{children}</div>
            {footer && (
              <div className="flex justify-end gap-2 border-t border-white/[0.06] px-5 py-3.5">{footer}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-medium text-fg-2">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11px] text-muted">{hint}</div>}
    </label>
  );
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-white/[0.05] text-muted">{icon}</div>
      <div className="text-[15px] font-semibold">{title}</div>
      {text && <div className="mt-1 max-w-sm text-sm text-muted">{text}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  accent?: string;
}) {
  return (
    <Card className="relative overflow-hidden p-4">
      {accent && (
        <div
          className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full blur-3xl opacity-30"
          style={{ background: accent }}
        />
      )}
      <div className="flex items-center gap-2 text-xs font-medium text-muted">
        {icon}
        {label}
      </div>
      <div className="num mt-2 text-[22px] font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </Card>
  );
}
