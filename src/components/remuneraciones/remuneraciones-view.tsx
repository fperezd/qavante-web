"use client";

import * as React from "react";
import { Users, Wallet, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBukEmployees, useBukPayroll, useSyncBukPayroll } from "@/lib/api/buk";
import { useBankMovements, usePayrollPayday, useSetPayrollPayday } from "@/lib/api/treasury";
import { DotacionView } from "./dotacion-view";
import { PlanillaView } from "./planilla-view";
import { PayrollSyncBar } from "./payroll-sync-bar";
import { EmpleadoDetalle } from "./empleado-detalle";
import { ConciliacionSueldosView } from "./conciliacion-sueldos-view";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import { normalizePayrollDetalle } from "./payroll-detalle";
import type { BankDebitLike } from "./payroll-conciliacion";
import type { EmployeeSlim } from "./buk-format";

/* RemuneracionesView — Client Component de la sección Remuneraciones. Tres
   pestañas: Dotación (empleados), Planilla (totales + detalle por empleado) y
   Conciliación (cruza el líquido de cada trabajador contra los débitos del
   banco). Invoca los hooks BUK + movimientos bancarios. Montado por la page
   solo con el flag `remuneraciones` ON. */

type Tab = "dotacion" | "planilla" | "conciliacion";

const TABS: ReadonlyArray<{ id: Tab; label: string; Icon: typeof Users }> = [
  { id: "dotacion", label: "Dotación", Icon: Users },
  { id: "planilla", label: "Planilla", Icon: Wallet },
  { id: "conciliacion", label: "Conciliación", Icon: Landmark },
];

export function RemuneracionesView() {
  const [tab, setTab] = React.useState<Tab>("dotacion");
  const [selected, setSelected] = React.useState<EmployeeSlim | null>(null);
  const [period, setPeriod] = React.useState<string | null>(null);

  const employeesQuery = useBukEmployees();
  const payrollQuery = useBukPayroll({ period: period ?? "", detalle: true });
  const bankQuery = useBankMovements({ period: period ?? "" });

  const empleados = React.useMemo(
    () => normalizePayrollDetalle(payrollQuery.data),
    [payrollQuery.data],
  );
  const movimientos = React.useMemo<BankDebitLike[]>(
    () =>
      (bankQuery.data?.items ?? []).map((m) => ({
        id: m.id,
        date: m.date,
        description: m.description,
        amount: m.amount,
        direction: m.direction,
      })),
    [bankQuery.data],
  );
  /* Hay planilla del período pero sin detalle por empleado (contrato backend
     pendiente) → la conciliación no puede cruzar todavía. */
  const detalleUnavailable = Boolean(payrollQuery.data?.totales) && empleados.length === 0;

  return (
    <div className="space-y-4">
      <div
        className="flex gap-1 border-b border-border"
        role="tablist"
        aria-label="Secciones de Remuneraciones"
      >
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={cn(
                "-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-brand-primary text-brand-primary"
                  : "border-transparent text-neutral-mid hover:text-neutral-dark",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      {tab === "dotacion" && <DotacionView query={employeesQuery} onSelect={setSelected} />}
      {tab === "planilla" && (
        <div className="space-y-4">
          <PlanillaView period={period} onPeriodChange={setPeriod} query={payrollQuery} />
          {period && payrollQuery.data?.totales && (
            <PayrollSync
              period={period}
              totalLiquido={payrollQuery.data.totales.total_liquido}
              periodLabel={formatPeriodLabel(period)}
            />
          )}
        </div>
      )}
      {tab === "conciliacion" && (
        <ConciliacionSueldosView
          period={period}
          onPeriodChange={setPeriod}
          empleados={empleados}
          movimientos={movimientos}
          loading={payrollQuery.isFetching || bankQuery.isFetching}
          error={bankQuery.error ?? payrollQuery.error}
          detalleUnavailable={detalleUnavailable}
        />
      )}

      <EmpleadoDetalle employee={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

/* Contenedor de la barra de sync (ADR-0056): registra el líquido del período como
   obligación "Remuneraciones" en Pagar + configura el día de pago. Usa los hooks
   (mutations); la barra es presentacional. */
function PayrollSync({
  period,
  totalLiquido,
  periodLabel,
}: {
  period: string;
  totalLiquido?: number;
  periodLabel?: string;
}) {
  const payday = usePayrollPayday();
  const sync = useSyncBukPayroll();
  const setPayday = useSetPayrollPayday();

  return (
    <PayrollSyncBar
      paydayRule={payday.data?.effective_rule}
      paydayDay={payday.data?.payday_day}
      totalLiquido={totalLiquido}
      periodLabel={periodLabel}
      onSync={() => sync.mutate(period)}
      syncing={sync.isPending}
      syncResult={sync.data ?? null}
      syncError={sync.error}
      onSavePayday={(day) => setPayday.mutate({ payday_day: day })}
      savingPayday={setPayday.isPending}
      paydayError={setPayday.error}
    />
  );
}
