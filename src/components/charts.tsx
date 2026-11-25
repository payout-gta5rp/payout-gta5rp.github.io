import { useState } from "react";
import { cn, money } from "@/lib/format";

/** Столбики по неделям: одна серия, величина. Подсказка при наведении, сетка приглушена. */
export function WeekBars({
  data,
  height = 220,
  currency,
  onSelect,
}: {
  data: { key: string; label: string; value: number; sub?: string; current?: boolean }[];
  height?: number;
  currency?: string;
  onSelect?: (key: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = niceMax(max);
  const ticks = [0, 0.5, 1].map((k) => nice * k);
  const W = 100 / Math.max(1, data.length);

  return (
    <div className="relative select-none" style={{ height }}>
      {/* Сетка */}
      <div className="absolute inset-0 bottom-6 left-12">
        {ticks.map((t) => (
          <div key={t} className="absolute left-0 right-0 border-t border-white/[0.05]" style={{ bottom: `${(t / nice) * 100}%` }}>
            <span className="num absolute -left-12 -translate-y-1/2 font-mono text-[10px] text-faint">{short(t)}</span>
          </div>
        ))}
      </div>
      {/* Столбики */}
      <div className="absolute inset-0 bottom-6 left-12 flex items-end">
        {data.map((d, i) => {
          const h = (d.value / nice) * 100;
          return (
            <div
              key={d.key}
              className="relative flex h-full cursor-pointer items-end justify-center"
              style={{ width: `${W}%` }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(d.key)}
            >
              <div
                className={cn(
                  "w-[min(28px,60%)] rounded-t-[4px] transition-all duration-300",
                  d.current
                    ? "bg-[repeating-linear-gradient(135deg,rgb(139_108_255/0.55)_0_4px,rgb(139_108_255/0.25)_4px_8px)]"
                    : "bg-gradient-to-t from-accent/70 to-accent-2/80",
                  hover === i && "brightness-125",
                  hover != null && hover !== i && "opacity-50",
                )}
                style={{ height: `${Math.max(h, d.value ? 1.5 : 0)}%` }}
              />
              {hover === i && (
                <div className="pointer-events-none absolute bottom-full z-10 mb-2 w-max -translate-y-1 rounded-xl border border-white/10 bg-ink-800/95 px-3 py-2 text-xs shadow-xl backdrop-blur"
                  style={{ bottom: `${h}%` }}>
                  <div className="text-muted">{d.label}{d.current ? " · текущая" : ""}</div>
                  <div className="num mt-0.5 text-sm font-semibold text-fg">{money(d.value, currency)}</div>
                  {d.sub && <div className="text-muted">{d.sub}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Подписи */}
      <div className="absolute bottom-0 left-12 right-0 flex h-5">
        {data.map((d, i) => (
          <div
            key={d.key}
            className={cn("truncate text-center text-[10px]", hover === i ? "text-fg-2" : "text-faint")}
            style={{ width: `${W}%` }}
          >
            {data.length > 14 && i % 2 ? "" : d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Горизонтальные полосы с прямыми подписями (отдел = цвет + название, не только цвет). */
export function ShareBars({
  data,
  currency,
}: {
  data: { key: string; label: string; color: string; value: number }[];
  currency?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.key} className="group" title={`${d.label}: ${money(d.value, currency)}`}>
          <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
            <span className="flex items-center gap-2 text-fg-2">
              <span className="size-2 rounded-full" style={{ background: d.color }} />
              {d.label}
            </span>
            <span className="num font-mono text-fg">
              {money(d.value)}
              <span className="ml-2 text-xs text-muted">{Math.round((d.value / total) * 100)}%</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.04]">
            <div
              className="h-full rounded-full transition-all duration-500 group-hover:brightness-125"
              style={{ width: `${(d.value / max) * 100}%`, background: d.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Мини-график для карточек. */
export function Sparkline({ values, color = "#8b6cff", width = 120, height = 32 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 2 - ((v - min) / (max - min || 1)) * (height - 4)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={"sg" + color.slice(1)} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.3" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L ${width} ${height} L 0 ${height} Z`} fill={`url(#sg${color.slice(1)})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={color} />
    </svg>
  );
}

function niceMax(v: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return m * p;
}

function short(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + "M";
  if (n >= 1000) return Math.round(n / 1000) + "k";
  return String(n);
}
