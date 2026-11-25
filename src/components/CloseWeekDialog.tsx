import { AlertTriangle, CheckCircle2, FileSpreadsheet, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { downloadWeekReport } from "@/export/report";
import { useCurrentCalc } from "@/hooks";
import { cn, money, period, plural } from "@/lib/format";
import { go } from "@/lib/router";
import { useStore } from "@/store";
import { useUi } from "@/uiStore";
import { Button, Modal } from "./ui";

export function CloseWeekDialog() {
  const open = useUi((s) => s.closeWeek);
  const setUi = useUi((s) => s.set);
  const start = useStore((s) => s.current.start);
  const employees = useStore((s) => s.employees);
  const archive = useStore((s) => s.archive);
  const calc = useCurrentCalc();
  const [force, setForce] = useState(false);
  const [withReport, setWithReport] = useState(true);
  const close = () => {
    setUi({ closeWeek: false });
    setForce(false);
  };

  const lines = Object.values(calc.lines).filter((l) => l.gross > 0);
  const unpaid = lines.filter((l) => !l.paid);
  const noPassport = lines.filter((l) => !employees.find((e) => e.id === l.employeeId)?.passport);
  const entries = useStore.getState().current.entries;
  const drift = lines.filter((l) => l.paid && entries[l.employeeId]?.paidAmount != null && entries[l.employeeId]!.paidAmount !== l.net);
  const duplicate = archive.some((w) => w.start === start);
  const empty = lines.length === 0;

  const checks = [
    {
      ok: !empty,
      text: empty ? "Нет ни одного начисления" : `${lines.length} ${plural(lines.length, "начисление", "начисления", "начислений")} на ${money(calc.totals.net)}`,
    },
    {
      ok: unpaid.length === 0,
      text: unpaid.length ? `Не выдано: ${unpaid.length} чел. на ${money(calc.totals.unpaidNet)}` : "Всем всё выдано",
    },
    {
      ok: noPassport.length === 0,
      text: noPassport.length ? `Без паспорта: ${noPassport.length} чел.` : "Паспорта указаны у всех",
    },
    {
      ok: drift.length === 0,
      text: drift.length
        ? `Сумма изменилась после выдачи: ${drift.length} чел. — проверьте ведомость`
        : "Выданные суммы не менялись",
    },
    { ok: !duplicate, text: duplicate ? "Неделя с такой датой уже есть в архиве" : "Неделя ещё не в архиве" },
  ];
  const blocking = empty || (!force && (unpaid.length > 0 || duplicate));

  const doClose = async () => {
    const week = useStore.getState().closeWeek();
    close();
    if (withReport) await downloadWeekReport(week);
    toast.success(`Неделя ${period(week.start)} закрыта`, {
      description: "Снимок сохранён в архиве, открыта следующая неделя",
      action: { label: "Открыть архив", onClick: () => go({ name: "archive", id: week.id }) },
    });
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={
        <span className="flex items-center gap-2">
          <Lock size={16} className="text-accent" /> Закрыть неделю {period(start)}
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Отмена
          </Button>
          <Button variant="primary" onClick={doClose} disabled={blocking}>
            Закрыть и открыть следующую
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-muted">
        Неделя сохранится в архив вместе с тарифами и составом. Изменить её потом будет нельзя, только открыть заново.
        В новую неделю перейдут сотрудники и выбранные способы выплаты.
      </p>
      <div className="space-y-2">
        {checks.map((c, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm",
              c.ok ? "border-good/20 bg-good/[0.06]" : "border-warn/25 bg-warn/[0.07]",
            )}
          >
            {c.ok ? <CheckCircle2 size={17} className="text-good" /> : <AlertTriangle size={17} className="text-warn" />}
            {c.text}
          </div>
        ))}
      </div>
      {(unpaid.length > 0 || duplicate) && !empty && (
        <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm text-fg-2">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="size-4 accent-[#8b6cff]" />
          Всё равно закрыть
        </label>
      )}
      <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-fg-2">
        <input type="checkbox" checked={withReport} onChange={(e) => setWithReport(e.target.checked)} className="size-4 accent-[#8b6cff]" />
        <FileSpreadsheet size={15} className="text-good" /> Сразу скачать отчёт .xlsx для админов
      </label>
    </Modal>
  );
}
