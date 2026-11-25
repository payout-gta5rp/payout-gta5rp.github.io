import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addDays, emptyWorkspace, mondayOf, type Workspace } from "@/data/templates";
import { calcWeek, emptyEntry, normalizeShares } from "@/engine/calc";
import { SCHEMA_VERSION, migrateWorkspace } from "@/data/migrate";
import type { Adjustment, ClosedWeek, Employee, Entry, Id, OrgConfig } from "@/engine/types";

export const uid = () => Math.random().toString(36).slice(2, 10);

export interface LogItem {
  id: string;
  at: string;
  text: string;
}

interface State extends Workspace {
  log: LogItem[];
  past: Record<Id, Entry>[];
  future: Record<Id, Entry>[];

  /** Заменить всё рабочее пространство (демо, чистый лист). */
  loadWorkspace: (ws: Workspace) => void;
  importWorkspace: (ws: Workspace) => void;
  /** Новая организация: настройки + (необязательно) сотрудники; неделя и архив пустые. */
  startOrganization: (config: OrgConfig, employees?: Employee[]) => void;
  /** Подмена настроек (например, из файла), сотрудники переназначаются на существующие отделы/должности. */
  replaceConfig: (config: OrgConfig) => void;
  /** Массовое добавление сотрудников. */
  importEmployees: (list: Omit<Employee, "id">[]) => number;
  /** Растянуть % вклада отдела до 100%. */
  normalizeDeptShares: (deptId: Id) => void;

  // Неделя
  setCount: (empId: Id, actionId: Id, n: number) => void;
  setShare: (empId: Id, v: number | undefined) => void;
  setManual: (empId: Id, v: number | undefined) => void;
  addAdjustment: (empId: Id, adj: Omit<Adjustment, "id">) => void;
  removeAdjustment: (empId: Id, adjId: Id) => void;
  setMethod: (empId: Id, methodId: Id) => void;
  setPaid: (empIds: Id[], paid: boolean) => void;
  setNote: (empId: Id, note: string) => void;
  clearEmployeeWeek: (empId: Id) => void;
  setWeekStart: (iso: string) => void;
  closeWeek: () => ClosedWeek;
  reopenLast: () => void;
  undo: () => void;
  redo: () => void;

  // Сотрудники
  addEmployee: (e: Omit<Employee, "id">) => Employee;
  updateEmployee: (id: Id, patch: Partial<Employee>) => void;
  removeEmployee: (id: Id) => void;

  // Настройки
  updateConfig: (fn: (c: OrgConfig) => void) => void;
}

const HISTORY = 60;

export const useStore = create<State>()(
  persist(
    (set, get) => {
      /** Изменение записей текущей недели с историей для Ctrl+Z. */
      const editEntries = (fn: (entries: Record<Id, Entry>) => void, logText?: string) => {
        const s = get();
        const next = structuredClone(s.current.entries);
        fn(next);
        set({
          current: { ...s.current, entries: next },
          past: [...s.past, s.current.entries].slice(-HISTORY),
          future: [],
          log: logText ? pushLog(s.log, logText) : s.log,
        });
      };
      const ensure = (entries: Record<Id, Entry>, id: Id) => (entries[id] ??= emptyEntry());
      const empName = (id: Id) => get().employees.find((e) => e.id === id)?.name ?? "?";

      return {
        ...emptyWorkspace(),
        log: [],
        past: [],
        future: [],

        loadWorkspace: (ws) => set({ ...ws, log: [], past: [], future: [] }),
        importWorkspace: (ws) =>
          set({ ...migrateWorkspace(ws), log: pushLog(get().log, "Импорт данных из файла"), past: [], future: [] }),
        startOrganization: (config, employees = []) =>
          set({
            config: structuredClone(config),
            employees,
            current: { start: mondayOf(new Date()), entries: {} },
            archive: [],
            demo: false,
            onboarded: true,
            past: [],
            future: [],
            log: pushLog([], `Создана организация ${config.short}`),
          }),
        replaceConfig: (config) => {
          const s = get();
          const depts = new Set(config.departments.map((d) => d.id));
          const poss = new Set(config.positions.map((p) => p.id));
          const byName = <T extends { id: Id; name: string }>(list: T[], oldList: T[], id: Id) => {
            const name = oldList.find((x) => x.id === id)?.name.toLowerCase();
            return list.find((x) => x.name.toLowerCase() === name)?.id ?? list[list.length - 1]?.id ?? id;
          };
          const employees = s.employees.map((e) => ({
            ...e,
            deptId: depts.has(e.deptId) ? e.deptId : byName(config.departments, s.config.departments, e.deptId),
            positionId: poss.has(e.positionId) ? e.positionId : byName(config.positions, s.config.positions, e.positionId),
          }));
          set({ config: structuredClone(config), employees, log: pushLog(s.log, "Настройки загружены из файла") });
        },
        importEmployees: (list) => {
          const s = get();
          const added = list.map((e) => ({ ...e, id: uid(), name: e.name.trim(), passport: e.passport.trim() }));
          set({ employees: [...s.employees, ...added], log: pushLog(s.log, `Импортировано сотрудников: ${added.length}`) });
          return added.length;
        },
        normalizeDeptShares: (deptId) => {
          const s = get();
          const ids = s.employees.filter((e) => e.active && e.deptId === deptId).map((e) => e.id);
          const shares: Record<Id, number> = {};
          for (const id of ids) shares[id] = s.current.entries[id]?.share ?? 0;
          const norm = normalizeShares(shares);
          const dept = s.config.departments.find((d) => d.id === deptId);
          editEntries((en) => {
            for (const [id, v] of Object.entries(norm)) ensure(en, id).share = v;
          }, `${dept?.name}: % вклада приведены к 100%`);
        },

        setCount: (empId, actionId, n) => {
          const v = Math.max(0, Math.min(9999, Math.floor(n || 0)));
          const prev = get().current.entries[empId]?.counts[actionId] ?? 0;
          if (prev === v) return;
          const a = get().config.actions.find((x) => x.id === actionId);
          editEntries((en) => {
            const e = ensure(en, empId);
            if (v) e.counts[actionId] = v;
            else delete e.counts[actionId];
          }, `${empName(empId)}: ${a?.short ?? actionId} ${prev} → ${v}`);
        },
        setShare: (empId, v) =>
          editEntries((en) => {
            ensure(en, empId).share = v == null ? undefined : Math.max(0, Math.min(100, v));
          }, `${empName(empId)}: % вклада → ${v ?? "—"}`),
        setManual: (empId, v) =>
          editEntries((en) => {
            ensure(en, empId).manual = v == null ? undefined : Math.max(0, v);
          }, `${empName(empId)}: сумма вручную → ${v ?? "—"}`),
        addAdjustment: (empId, adj) =>
          editEntries((en) => {
            ensure(en, empId).adjustments.push({ ...adj, id: uid() });
          }, `${empName(empId)}: корректировка ${adj.amount > 0 ? "+" : ""}${adj.amount} (${adj.reason})`),
        removeAdjustment: (empId, adjId) =>
          editEntries((en) => {
            const e = ensure(en, empId);
            e.adjustments = e.adjustments.filter((a) => a.id !== adjId);
          }, `${empName(empId)}: корректировка удалена`),
        setMethod: (empId, methodId) =>
          editEntries((en) => {
            ensure(en, empId).methodId = methodId;
          }, `${empName(empId)}: способ → ${get().config.methods.find((m) => m.id === methodId)?.name}`),
        setPaid: (empIds, paid) =>
          editEntries(
            (en) => {
              const now = new Date().toISOString();
              const s = get();
              const calc = calcWeek(s.config, s.employees, en);
              for (const id of empIds) {
                const e = ensure(en, id);
                e.paid = paid;
                e.paidAt = paid ? now : undefined;
                e.paidAmount = paid ? calc.lines[id]?.net : undefined;
              }
            },
            empIds.length === 1
              ? `${empName(empIds[0])}: ${paid ? "выдано" : "отмена выдачи"}`
              : `${paid ? "Выдано" : "Отмена выдачи"}: ${empIds.length} чел.`,
          ),
        setNote: (empId, note) =>
          editEntries((en) => {
            ensure(en, empId).note = note || undefined;
          }),
        clearEmployeeWeek: (empId) =>
          editEntries((en) => {
            const e = ensure(en, empId);
            en[empId] = { ...emptyEntry(), methodId: e.methodId };
          }, `${empName(empId)}: данные недели очищены`),
        setWeekStart: (iso) => set({ current: { ...get().current, start: iso } }),

        closeWeek: () => {
          const s = get();
          const involved = new Set(Object.keys(s.current.entries));
          const members = s.employees.filter((e) => e.active || involved.has(e.id)).map((e) => ({ ...e }));
          const week: ClosedWeek = {
            id: "w-" + s.current.start + "-" + uid(),
            start: s.current.start,
            closedAt: new Date().toISOString(),
            config: structuredClone(s.config),
            members,
            entries: structuredClone(s.current.entries),
          };
          // В новую неделю переносим только выбранный способ выплаты
          const carry: Record<Id, Entry> = {};
          for (const [id, e] of Object.entries(s.current.entries)) {
            if (e.methodId) carry[id] = { ...emptyEntry(), methodId: e.methodId };
          }
          set({
            archive: [...s.archive, week],
            current: { start: addDays(s.current.start, 7), entries: carry },
            past: [],
            future: [],
            log: pushLog(s.log, `Неделя ${s.current.start} закрыта и отправлена в архив`),
          });
          return week;
        },
        reopenLast: () => {
          const s = get();
          const last = s.archive[s.archive.length - 1];
          if (!last) return;
          set({
            archive: s.archive.slice(0, -1),
            current: { start: last.start, entries: structuredClone(last.entries) },
            past: [],
            future: [],
            log: pushLog(s.log, `Неделя ${last.start} открыта заново`),
          });
        },

        undo: () => {
          const s = get();
          const prev = s.past[s.past.length - 1];
          if (!prev) return;
          set({
            current: { ...s.current, entries: prev },
            past: s.past.slice(0, -1),
            future: [s.current.entries, ...s.future].slice(0, HISTORY),
          });
        },
        redo: () => {
          const s = get();
          const next = s.future[0];
          if (!next) return;
          set({
            current: { ...s.current, entries: next },
            past: [...s.past, s.current.entries].slice(-HISTORY),
            future: s.future.slice(1),
          });
        },

        addEmployee: (e) => {
          const emp: Employee = { ...e, id: uid(), name: e.name.trim(), passport: e.passport.trim() };
          set({ employees: [...get().employees, emp], log: pushLog(get().log, `Добавлен сотрудник ${emp.name}`) });
          return emp;
        },
        updateEmployee: (id, patch) => {
          const clean = { ...patch };
          if (clean.name != null) clean.name = clean.name.trim();
          if (clean.passport != null) clean.passport = clean.passport.trim();
          set({ employees: get().employees.map((e) => (e.id === id ? { ...e, ...clean } : e)) });
        },
        removeEmployee: (id) => {
          const s = get();
          const entries = { ...s.current.entries };
          delete entries[id];
          set({
            employees: s.employees.filter((e) => e.id !== id),
            current: { ...s.current, entries },
            log: pushLog(s.log, `Удалён сотрудник ${empName(id)} (архив не затронут)`),
          });
        },

        updateConfig: (fn) => {
          const c = structuredClone(get().config);
          fn(c);
          set({ config: c });
        },
      };
    },
    {
      name: "payout:v1",
      version: SCHEMA_VERSION,
      migrate: (persisted) => migrateWorkspace(persisted as Workspace) as never,
      partialize: (s) => ({
        config: s.config,
        employees: s.employees,
        current: s.current,
        archive: s.archive,
        demo: s.demo,
        onboarded: s.onboarded,
        log: s.log,
      }),
    },
  ),
);

function pushLog(log: LogItem[], text: string): LogItem[] {
  return [{ id: uid(), at: new Date().toISOString(), text }, ...log].slice(0, 500);
}

export function exportWorkspace(): Workspace {
  const s = useStore.getState();
  return { config: s.config, employees: s.employees, current: s.current, archive: s.archive, demo: s.demo };
}
