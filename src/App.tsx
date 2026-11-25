import { Toaster } from "sonner";
import { CloseWeekDialog } from "@/components/CloseWeekDialog";
import { EmployeeForm } from "@/components/EmployeeForm";
import { OrgWizard } from "@/components/OrgWizard";
import { Shell } from "@/components/Shell";
import { Welcome } from "@/components/Welcome";
import { useStore } from "@/store";
import { useRoute } from "@/lib/router";
import { ArchivePage } from "@/pages/Archive";
import { EmployeesPage } from "@/pages/Employees";
import { OverviewPage } from "@/pages/Overview";
import { PayoutsPage } from "@/pages/Payouts";
import { SettingsPage } from "@/pages/Settings";
import { WeekPage } from "@/pages/Week";

export function App() {
  const route = useRoute();
  const onboarded = useStore((s) => s.onboarded !== false);
  return (
    <>
      {onboarded ? (
        <>
          <Shell route={route}>
            {route.name === "overview" && <OverviewPage />}
            {route.name === "week" && <WeekPage />}
            {route.name === "payouts" && <PayoutsPage />}
            {route.name === "archive" && <ArchivePage id={route.id} />}
            {route.name === "employees" && <EmployeesPage id={route.id} />}
            {route.name === "settings" && <SettingsPage tab={route.tab} />}
          </Shell>
          <CloseWeekDialog />
          <EmployeeForm />
        </>
      ) : (
        <Welcome />
      )}
      <OrgWizard />
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "rgb(16 19 28 / 0.95)",
            border: "1px solid rgb(255 255 255 / 0.08)",
            color: "#eef0f6",
            backdropFilter: "blur(12px)",
          },
        }}
      />
    </>
  );
}
