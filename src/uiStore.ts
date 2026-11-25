import { create } from "zustand";

interface Ui {
  palette: boolean;
  closeWeek: boolean;
  wizard: boolean;
  employeeForm: { id?: string; deptId?: string } | null;
  set: (p: Partial<Omit<Ui, "set">>) => void;
}

export const useUi = create<Ui>()((set) => ({
  palette: false,
  closeWeek: false,
  wizard: false,
  employeeForm: null,
  set: (p) => set(p),
}));
