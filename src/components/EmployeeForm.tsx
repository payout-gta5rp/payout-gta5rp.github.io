import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/store";
import { useUi } from "@/uiStore";
import { Button, Field, Input, Modal, Segmented, Select } from "./ui";

export function EmployeeForm() {
  const form = useUi((s) => s.employeeForm);
  const setUi = useUi((s) => s.set);
  const config = useStore((s) => s.config);
  const employees = useStore((s) => s.employees);
  const editing = form?.id ? employees.find((e) => e.id === form.id) : undefined;

  const [name, setName] = useState("");
  const [passport, setPassport] = useState("");
  const [deptId, setDeptId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [active, setActive] = useState("yes");

  useEffect(() => {
    if (!form) return;
    setName(editing?.name ?? "");
    setPassport(editing?.passport ?? "");
    setDeptId(editing?.deptId ?? form.deptId ?? config.departments[0]?.id ?? "");
    setPositionId(editing?.positionId ?? config.positions[config.positions.length - 1]?.id ?? "");
    setActive(editing ? (editing.active ? "yes" : "no") : "yes");
  }, [form, editing, config]);

  const close = () => setUi({ employeeForm: null });
  const dupName = name.trim() && employees.some((e) => e.id !== editing?.id && e.name.toLowerCase() === name.trim().toLowerCase());
  const dupPass = passport.trim() && employees.some((e) => e.id !== editing?.id && e.passport === passport.trim());

  const save = () => {
    if (!name.trim()) return;
    const data = { name, passport, deptId, positionId, active: active === "yes" };
    if (editing) {
      useStore.getState().updateEmployee(editing.id, data);
      toast.success("Сохранено");
    } else {
      useStore.getState().addEmployee(data);
      toast.success(`${name.trim()} добавлен`);
    }
    close();
  };

  return (
    <Modal
      open={!!form}
      onClose={close}
      title={editing ? "Сотрудник" : "Новый сотрудник"}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Отмена
          </Button>
          <Button variant="primary" onClick={save} disabled={!name.trim()}>
            {editing ? "Сохранить" : "Добавить"}
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="col-span-2">
          <Field label="Имя и фамилия" hint={dupName ? "⚠ Сотрудник с таким именем уже есть" : undefined}>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="John Smith" />
          </Field>
        </div>
        <Field label="№ паспорта" hint={dupPass ? "⚠ Такой паспорт уже есть" : undefined}>
          <Input value={passport} onChange={(e) => setPassport(e.target.value.replace(/\D/g, ""))} placeholder="123456" className="font-mono" />
        </Field>
        <Field label="Участвует в премии">
          <Segmented
            value={active}
            onChange={setActive}
            options={[
              { value: "yes", label: "Да" },
              { value: "no", label: "Нет" },
            ]}
          />
        </Field>
        <Field label="Отдел">
          <Select value={deptId} onChange={setDeptId} options={config.departments.map((d) => ({ value: d.id, label: d.name }))} />
        </Field>
        <Field label="Должность">
          <Select
            value={positionId}
            onChange={setPositionId}
            options={config.positions.map((p) => ({
              value: p.id,
              label: p.name + (p.multiplier !== 100 ? ` · ×${p.multiplier / 100}` : ""),
            }))}
          />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
