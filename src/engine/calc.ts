import type {
  CalcStep,
  CalcWarning,
  DeptTotal,
  Entry,
  Id,
  Line,
  Member,
  OrgConfig,
  RoundingMode,
  Totals,
  WeekCalc,
} from "./types";

/**
 * Универсальный конвейер расчёта премии. Шаги:
 *   1. основа (баллы / доля бюджета / ставка / вручную)
 *   2. множитель должности
 *   3. разовые корректировки
 *   4. недельный лимит
 *   5. округление (+ распределение остатка бюджета отдела)
 *   6. комиссия способа выплаты
 * Чистая функция: одинаково считает на экране, в архиве и в отчёте .xlsx.
 */

export const emptyEntry = (): Entry => ({ counts: {}, adjustments: [], paid: false });

export function roundBy(value: number, mode: RoundingMode, step: number): number {
  const s = step > 0 ? step : 1;
  if (mode === "floor") return Math.floor(value / s + 1e-9) * s;
  if (mode === "round") return Math.round(value / s) * s;
  return value;
}

export function pointsOf(entry: Entry | undefined, config: OrgConfig, deptId?: Id): number {
  if (!entry) return 0;
  let sum = 0;
  for (const a of config.actions) {
    const n = entry.counts[a.id];
    if (!n) continue;
    if (deptId && a.deptIds && a.deptIds.length && !a.deptIds.includes(deptId)) continue;
    sum += n * a.points;
  }
  return sum;
}

export function calcWeek(
  config: OrgConfig,
  members: Member[],
  entries: Record<Id, Entry>,
): WeekCalc {
  const { rules } = config;
  const deptById = new Map(config.departments.map((d) => [d.id, d]));
  const posById = new Map(config.positions.map((p) => [p.id, p]));
  const methodById = new Map(config.methods.map((m) => [m.id, m]));
  const active = members.filter((m) => m.active && deptById.has(m.deptId));

  // ── Бюджеты отделов (budgetShare): общий бюджет − фикс. ставки, по весам ──
  const fixedSum = active.reduce((s, m) => {
    if (deptById.get(m.deptId)?.mode !== "fixed") return s;
    return s + (posById.get(m.positionId)?.fixedRate ?? 0);
  }, 0);
  const pool = Math.max(0, rules.budget - fixedSum);
  const deptBudget = new Map<Id, number>();
  const shareDeptList = config.departments.filter((d) => d.mode === "budgetShare");
  const weightSum = shareDeptList.reduce((s, d) => s + (d.weight ?? 0), 0);
  const step = rules.rounding.mode === "none" ? 1 : Math.max(1, rules.rounding.step);
  let budgetResidue = 0;
  if (rules.remainder !== "none" && shareDeptList.length && Math.abs(weightSum - 100) <= 0.5) {
    // Метод наибольших остатков: каждому отделу — вниз до шага, а оставшиеся шаги
    // получают отделы с самой большой отброшенной частью. Сумма бюджетов = остатку на отделы.
    const target = Math.floor(pool / step + 1e-9) * step;
    budgetResidue = pool - target;
    const raw = shareDeptList.map((d) => ({ id: d.id, exact: (target * (d.weight ?? 0)) / weightSum }));
    const parts = raw.map((r) => ({ ...r, base: Math.floor(r.exact / step + 1e-9) * step }));
    let left = target - parts.reduce((s, p) => s + p.base, 0);
    parts.sort((a, b) => b.exact - b.base - (a.exact - a.base));
    for (let i = 0; left >= step && i < parts.length * 1000; i++) {
      parts[i % parts.length].base += step;
      left -= step;
    }
    for (const p of parts) deptBudget.set(p.id, p.base);
  } else {
    for (const d of shareDeptList) {
      deptBudget.set(d.id, roundBy((pool * (d.weight ?? 0)) / 100, rules.rounding.mode, rules.rounding.step));
    }
  }

  // ── Шаг 1: основа ──
  const base = new Map<Id, number>();
  const pts = new Map<Id, number>();
  for (const m of active) {
    const d = deptById.get(m.deptId)!;
    const e = entries[m.id];
    const p = pointsOf(e, config, m.deptId);
    pts.set(m.id, p);
    let b = 0;
    if (d.mode === "points") b = p * priceOf(d, config);
    else if (d.mode === "fixed") b = posById.get(m.positionId)?.fixedRate ?? 0;
    else if (d.mode === "manual") b = e?.manual ?? 0;
    else if (d.mode === "budgetShare")
      // При распределении остатка округляем только вниз: иначе сумма долей может превысить бюджет отдела
      b = roundBy(
        ((deptBudget.get(d.id) ?? 0) * (e?.share ?? 0)) / 100,
        rules.remainder !== "none" && rules.rounding.mode === "round" ? "floor" : rules.rounding.mode,
        rules.rounding.step,
      );
    base.set(m.id, b);
  }

  // ── Остаток бюджета отдела после округления ──
  const shareSum = new Map<Id, number>();
  for (const d of config.departments) {
    if (d.mode !== "budgetShare") continue;
    const ms = active.filter((m) => m.deptId === d.id);
    const total = ms.reduce((s, m) => s + (entries[m.id]?.share ?? 0), 0);
    shareSum.set(d.id, total);
    if (rules.remainder === "none" || Math.abs(total - 100) > 0.5 || !ms.length) continue;
    const budget = deptBudget.get(d.id) ?? 0;
    let rem = budget - ms.reduce((s, m) => s + (base.get(m.id) ?? 0), 0);
    if (rem <= 0) continue;
    const ranked = [...ms]
      .filter((m) => (entries[m.id]?.share ?? 0) > 0)
      .sort((a, b) => (entries[b.id]?.share ?? 0) - (entries[a.id]?.share ?? 0));
    if (!ranked.length) continue;
    if (rules.remainder === "largest") {
      base.set(ranked[0].id, (base.get(ranked[0].id) ?? 0) + rem);
    } else {
      // proportional: раздаём шагами округления по наибольшей дробной части
      const step = rules.rounding.step > 0 ? rules.rounding.step : 1;
      const exact = ranked.map((m) => ({ id: m.id, frac: ((budget * (entries[m.id]?.share ?? 0)) / 100) % step }));
      exact.sort((a, b) => b.frac - a.frac);
      let i = 0;
      while (rem >= step && exact.length) {
        const id = exact[i % exact.length].id;
        base.set(id, (base.get(id) ?? 0) + step);
        rem -= step;
        i++;
      }
      if (rem > 0) base.set(ranked[0].id, (base.get(ranked[0].id) ?? 0) + rem);
    }
  }

  // ── Шаги 2–6 ──
  const lines: Record<Id, Line> = {};
  const depts: Record<Id, DeptTotal> = {};
  for (const d of config.departments) {
    depts[d.id] = {
      deptId: d.id,
      members: 0,
      paidMembers: 0,
      points: 0,
      gross: 0,
      net: 0,
      budget: deptBudget.get(d.id),
      shareSum: shareSum.get(d.id),
    };
  }
  const totals: Totals = {
    members: 0,
    points: 0,
    gross: 0,
    commission: 0,
    net: 0,
    paidCount: 0,
    paidNet: 0,
    unpaidNet: 0,
  };
  let leader: WeekCalc["leader"] = null;

  for (const m of active) {
    const d = deptById.get(m.deptId)!;
    const e = entries[m.id];
    const pos = posById.get(m.positionId);
    const steps: CalcStep[] = [];
    const p = pts.get(m.id) ?? 0;
    const b = base.get(m.id) ?? 0;

    if (d.mode === "points") {
      steps.push({ label: "Баллы", value: p, hint: "Σ кол-во × баллы действия" });
      steps.push({ label: "Основа", value: b, hint: `${p} × ${priceOf(d, config)}` });
    } else if (d.mode === "budgetShare") {
      steps.push({
        label: "Доля бюджета",
        value: b,
        hint: `${fmt(deptBudget.get(d.id) ?? 0)} × ${e?.share ?? 0}%`,
      });
    } else if (d.mode === "fixed") {
      steps.push({ label: "Ставка должности", value: b, hint: pos?.name });
    } else {
      steps.push({ label: "Сумма вручную", value: b });
    }

    const mult = pos?.multiplier ?? 100;
    let v = (b * mult) / 100;
    if (mult !== 100) steps.push({ label: "Множитель", value: v, hint: `× ${mult}% (${pos?.name})` });

    const adj = (e?.adjustments ?? []).reduce((s, a) => s + (a.amount || 0), 0);
    if (adj) {
      v += adj;
      steps.push({ label: "Корректировки", value: v, hint: `${adj > 0 ? "+" : ""}${fmt(adj)}` });
    }

    const cap = pos?.cap ?? rules.weeklyCap;
    let capped = false;
    if (cap != null && cap > 0 && v > cap) {
      v = cap;
      capped = true;
      steps.push({ label: "Недельный лимит", value: v, hint: `не больше ${fmt(cap)}` });
    }

    const rounded = Math.max(0, roundBy(v, rules.rounding.mode, rules.rounding.step));
    if (rounded !== v) steps.push({ label: "Округление", value: rounded });
    const gross = Math.round(rounded);

    const methodId = e?.methodId ?? rules.defaultMethodId;
    const method = methodById.get(methodId);
    const commission = gross > 0 ? Math.round((gross * (method?.commissionPct ?? 0)) / 100) : 0;
    const net = gross - commission;
    if (commission) steps.push({ label: "Комиссия", value: -commission, hint: `${method?.name} ${method?.commissionPct}%` });
    steps.push({ label: "К выдаче", value: net });

    const paid = !!e?.paid && gross > 0;
    lines[m.id] = {
      employeeId: m.id,
      deptId: d.id,
      points: p,
      base: b,
      multiplier: mult,
      adjustments: adj,
      capped,
      gross,
      methodId,
      commission,
      net,
      paid,
      steps,
    };

    const dt = depts[d.id];
    dt.points += p;
    if (gross > 0) {
      dt.members++;
      dt.gross += gross;
      dt.net += net;
      totals.members++;
      if (paid) {
        dt.paidMembers++;
        totals.paidCount++;
        totals.paidNet += net;
      } else totals.unpaidNet += net;
    }
    totals.points += p;
    totals.gross += gross;
    totals.commission += commission;
    totals.net += net;
    if (p > 0 && (!leader || p > leader.points)) leader = { employeeId: m.id, points: p };
  }

  // ── Предупреждения ──
  const warnings: CalcWarning[] = [];
  const hasBudget = config.departments.some((d) => d.mode === "budgetShare" || d.mode === "fixed");
  const shareDepts = config.departments.filter((d) => d.mode === "budgetShare");
  if (shareDepts.length) {
    const w = shareDepts.reduce((s, d) => s + (d.weight ?? 0), 0);
    if (Math.abs(w - 100) > 0.5) warnings.push({ kind: "weightSum", text: `Сумма весов отделов ${w}% вместо 100%` });
  }
  if (budgetResidue > 0) {
    warnings.push({
      kind: "budgetResidue",
      text: `Остаток на отделы не делится на шаг округления ${fmt(step)} — ${fmt(budgetResidue)} не распределяется`,
    });
  }
  if (hasBudget && rules.budget > 0 && fixedSum > rules.budget) {
    warnings.push({ kind: "budgetOverrun", text: `Фиксированные ставки (${fmt(fixedSum)}) больше общего бюджета (${fmt(rules.budget)})` });
  }
  for (const d of shareDepts) {
    const total = shareSum.get(d.id) ?? 0;
    if (total > 0 && Math.abs(total - 100) > 0.5)
      warnings.push({ kind: "shareSum", deptId: d.id, text: `${d.name}: сумма % вклада ${round1(total)}% вместо 100%` });
  }
  const maxed = config.actions.filter((a) => a.maxPerWeek != null && a.maxPerWeek > 0);
  for (const m of active) {
    const e = entries[m.id];
    if (e && maxed.length)
      for (const a of maxed) {
        const n = e.counts[a.id] ?? 0;
        if (n > a.maxPerWeek!)
          warnings.push({
            kind: "actionMax",
            employeeId: m.id,
            actionId: a.id,
            text: `${m.name}: «${a.short}» ${n} при обычном максимуме ${a.maxPerWeek}`,
          });
      }
    if ((lines[m.id]?.gross ?? 0) > 0 && !m.passport.trim())
      warnings.push({ kind: "noPassport", employeeId: m.id, text: `${m.name}: не указан паспорт` });
  }

  return {
    lines,
    depts,
    totals,
    leader,
    warnings,
    budget: hasBudget ? { total: rules.budget, fixed: fixedSum, pool } : null,
  };
}

export function priceOf(d: { pointPrice?: number | null }, config: OrgConfig): number {
  return d.pointPrice != null && d.pointPrice >= 0 ? d.pointPrice : config.rules.pointPrice;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Пропорционально растягивает % вклада отдела до 100%, сохраняя пропорции (с точностью 0.1%). */
export function normalizeShares(shares: Record<Id, number>): Record<Id, number> {
  const ids = Object.keys(shares).filter((id) => shares[id] > 0);
  const total = ids.reduce((s, id) => s + shares[id], 0);
  if (!total) return { ...shares };
  const out: Record<Id, number> = {};
  let acc = 0;
  ids.forEach((id, i) => {
    if (i === ids.length - 1) out[id] = round1(100 - acc);
    else {
      out[id] = round1((shares[id] / total) * 100);
      acc += out[id];
    }
  });
  return out;
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString("ru-RU");
}
