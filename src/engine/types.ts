// Модель данных и настроек. Всё, что описывает правила расчёта, живёт в OrgConfig:
// открытая неделя считается по текущим настройкам, а закрытая хранит их снимок.

export type Id = string;

/** Основа расчёта отдела. */
export type BaseMode =
  | "points" // Σ(кол-во × баллы) × цена балла
  | "budgetShare" // бюджет отдела × % вклада
  | "fixed" // фиксированная ставка должности
  | "manual"; // сумма вводится вручную

export type RoundingMode = "none" | "floor" | "round";
/** Куда девать остаток бюджета отдела после округления (только для budgetShare). */
export type RemainderRule = "none" | "largest" | "proportional";

export interface Department {
  id: Id;
  name: string;
  color: string; // hex
  mode: BaseMode;
  /** Вес отдела в % от остатка бюджета (для budgetShare). */
  weight?: number;
  /** Своя цена балла отдела (points); не задано — общая из правил. */
  pointPrice?: number | null;
}

export interface Position {
  id: Id;
  name: string;
  /** Множитель в процентах: 100 = ×1.0. */
  multiplier: number;
  /** Ставка для отделов с основой «fixed». */
  fixedRate?: number;
  /** Свой недельный лимит должности; null/undefined = общий лимит. */
  cap?: number | null;
}

export interface ActionDef {
  id: Id;
  code: string;
  name: string;
  /** Короткое название для заголовка столбца. */
  short: string;
  group: string;
  points: number;
  /** Если задано — действие доступно только этим отделам. */
  deptIds?: Id[] | null;
  /** Ожидаемый максимум за неделю на человека: больше — предупреждение, не запрет. */
  maxPerWeek?: number | null;
  archived?: boolean;
}

export type WarningKind = "actionMax" | "shareSum" | "noPassport" | "budgetOverrun" | "budgetResidue" | "weightSum" | "capped";

export interface CalcWarning {
  kind: WarningKind;
  text: string;
  employeeId?: Id;
  deptId?: Id;
  actionId?: Id;
}

export interface PayoutMethod {
  id: Id;
  name: string;
  commissionPct: number;
}

export interface Rules {
  currency: string;
  pointPrice: number;
  weeklyCap: number | null;
  rounding: { mode: RoundingMode; step: number };
  remainder: RemainderRule;
  /** Общий недельный бюджет (для отделов budgetShare и fixed). */
  budget: number;
  defaultMethodId: Id;
}

export interface OrgConfig {
  name: string;
  short: string;
  departments: Department[];
  positions: Position[];
  actions: ActionDef[];
  methods: PayoutMethod[];
  rules: Rules;
}

export interface Employee {
  id: Id;
  name: string;
  passport: string;
  deptId: Id;
  positionId: Id;
  /** Участвует в премии. */
  active: boolean;
}

export interface Adjustment {
  id: Id;
  amount: number;
  reason: string;
}

export interface Entry {
  counts: Record<Id, number>;
  /** % вклада внутри отдела (budgetShare). */
  share?: number;
  /** Сумма вручную (manual). */
  manual?: number;
  adjustments: Adjustment[];
  methodId?: Id;
  paid: boolean;
  paidAt?: string; // ISO
  /** Сколько было выдано на момент отметки — чтобы заметить, если сумма потом изменилась. */
  paidAmount?: number;
  note?: string;
}

/** Снимок сотрудника в закрытой неделе. */
export type Member = Employee;

export interface ClosedWeek {
  id: Id;
  start: string; // ISO yyyy-mm-dd, понедельник
  closedAt: string;
  config: OrgConfig;
  members: Member[];
  entries: Record<Id, Entry>;
}

export interface CalcStep {
  label: string;
  value: number;
  hint?: string;
}

export interface Line {
  employeeId: Id;
  deptId: Id;
  points: number;
  base: number;
  multiplier: number;
  adjustments: number;
  capped: boolean;
  gross: number; // начислено
  methodId: Id;
  commission: number;
  net: number; // к выдаче
  paid: boolean;
  steps: CalcStep[];
}

export interface DeptTotal {
  deptId: Id;
  members: number;
  paidMembers: number;
  points: number;
  gross: number;
  net: number;
  budget?: number;
  shareSum?: number;
}

export interface Totals {
  members: number; // с начислением > 0
  points: number;
  gross: number;
  commission: number;
  net: number;
  paidCount: number;
  paidNet: number;
  unpaidNet: number;
}

export interface WeekCalc {
  lines: Record<Id, Line>;
  depts: Record<Id, DeptTotal>;
  totals: Totals;
  leader: { employeeId: Id; points: number } | null;
  warnings: CalcWarning[];
  /** Сумма фикс. ставок и остаток бюджета для отделов-долей. */
  budget: { total: number; fixed: number; pool: number } | null;
}
