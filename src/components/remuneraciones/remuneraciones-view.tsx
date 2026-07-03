"use client";

import * as React from "react";
import { Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBukEmployees, useBukPayroll } from "@/lib/api/buk";
import { DotacionView } from "./dotacion-view";
import { PlanillaView } from "./planilla-view";
import { EmpleadoDetalle } from "./empleado-detalle";
import type { EmployeeSlim } from "./buk-format";

/* RemuneracionesView — Client Component de la sección Remuneraciones. Dos
   pestañas: Dotación (empleados) y Planilla (totales del período). Invoca los
   hooks BUK y cablea el detalle de empleado (modal). Montado por la page solo
   con el flag `remuneraciones` ON. */

type Tab = "dotacion" | "planilla";

const TABS: ReadonlyArray<{ id: Tab; label: string; Icon: typeof Users }> = [
  { id: "dotacion", label: "Dotación", Icon: Users },
  { id: "planilla", label: "Planilla", Icon: Wallet },
];

export function RemuneracionesView() {
  const [tab, setTab] = React.useState<Tab>("dotacion");
  const [selected, setSelected] = React.useState<EmployeeSlim | null>(null);
  const [period, setPeriod] = React.useState<string | null>(null);

  const employeesQuery = useBukEmployees();
  const payrollQuery = useBukPayroll({ period: period ?? "", detalle: true });

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

      {tab === "dotacion" ? (
        <DotacionView query={employeesQuery} onSelect={setSelected} />
      ) : (
        <PlanillaView period={period} onPeriodChange={setPeriod} query={payrollQuery} />
      )}

      <EmpleadoDetalle employee={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
