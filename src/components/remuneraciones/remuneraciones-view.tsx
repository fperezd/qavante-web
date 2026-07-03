"use client";

import * as React from "react";
import { Users, Wallet, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBukEmployees, useBukPayroll } from "@/lib/api/buk";
import { useBankMovements } from "@/lib/api/treasury";
import { DotacionView } from "./dotacion-view";
import { PlanillaView } from "./planilla-view";
import { EmpleadoDetalle } from "./empleado-detalle";
import { ConciliacionSueldosView } from "./conciliacion-sueldos-view";
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
        <PlanillaView period={period} onPeriodChange={setPeriod} query={payrollQuery} />
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
