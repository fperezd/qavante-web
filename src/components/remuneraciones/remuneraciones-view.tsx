"use client";

import * as React from "react";
import { Users, Wallet, Landmark, Tags } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useBukEmployees,
  useBukPayroll,
  useBukPayrollDetail,
  useSyncBukPayroll,
} from "@/lib/api/buk";
import { useBankMovements, usePayrollPayday, useSetPayrollPayday } from "@/lib/api/treasury";
import {
  usePayrollWorkers,
  useSetWorkerAllocations,
  useBulkSetWorkerAllocations,
  type AllocationIn,
} from "@/lib/api/payroll-workers";
import { useManagementAccountsTree } from "@/lib/api/management";
import { useSiiF29Impuesto } from "@/lib/api/sii";
import { ApiError } from "@/lib/api/errors";
import { DotacionView } from "./dotacion-view";
import { PlanillaView } from "./planilla-view";
import { ClasificacionCuentasView } from "./clasificacion-cuentas-view";
import { payrollCuentaOptions } from "./payroll-cuentas";
import { PayrollSyncBar } from "./payroll-sync-bar";
import { EmpleadoDetalle } from "./empleado-detalle";
import { ConciliacionSueldosView } from "./conciliacion-sueldos-view";
import { ConciliacionBoardLive } from "./conciliacion-board-live";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import { PeriodRangeFilter } from "@/components/filters/period-range-filter";
import { presetRange, type PeriodRange } from "@/lib/period/period-range";
import { normalizePayrollDetalle } from "./payroll-detalle";
import type { BankDebitLike } from "./payroll-conciliacion";
import type { EmployeeSlim } from "./buk-format";

/* RemuneracionesView — Client Component de la sección Remuneraciones. Tres
   pestañas: Dotación (empleados), Planilla (totales + detalle por empleado) y
   Conciliación (cruza el líquido de cada trabajador contra los débitos del
   banco). Invoca los hooks BUK + movimientos bancarios. Montado por la page
   solo con el flag `remuneraciones` ON. */

type Tab = "dotacion" | "planilla" | "clasificacion" | "conciliacion";

const TABS: ReadonlyArray<{ id: Tab; label: string; Icon: typeof Users }> = [
  { id: "dotacion", label: "Dotación", Icon: Users },
  { id: "planilla", label: "Planilla", Icon: Wallet },
  { id: "clasificacion", label: "Clasificación", Icon: Tags },
  { id: "conciliacion", label: "Conciliación", Icon: Landmark },
];

export function RemuneracionesView({
  initialPeriod,
  reconcileBoardEnabled = false,
}: {
  initialPeriod?: string;
  /** #835: cuando ON, la Conciliación usa el board accionable del backend (asignar/desasignar).
   *  OFF (default/prod): la conciliación pasiva por-monto (sin regresión). */
  reconcileBoardEnabled?: boolean;
} = {}) {
  // Deep-link desde Pagar (ítem de nómina) → arranca en Planilla del período.
  const [tab, setTab] = React.useState<Tab>(initialPeriod ? "planilla" : "dotacion");
  const [selected, setSelected] = React.useState<EmployeeSlim | null>(null);
  /* Filtro de rango idéntico al Libro (pedido de Fernando: consistente en toda la
     app). Planilla y Conciliación son operaciones POR MES (se registra/concilia
     un mes) → usan el mes final del rango (`range.hasta`); por defecto el mes
     actual (rango de un mes), o el período del deep-link. */
  const [range, setRange] = React.useState<PeriodRange>(() =>
    initialPeriod ? { desde: initialPeriod, hasta: initialPeriod } : presetRange("mes_actual"),
  );
  const period = range.hasta;

  const employeesQuery = useBukEmployees();
  const payrollQuery = useBukPayroll({ period: period ?? "" });
  const payrollDetailQuery = useBukPayrollDetail(period);
  const bankQuery = useBankMovements({ period: period ?? "" });

  /* Impuesto de remuneraciones (IUSC, código 48) — NO viene en el payroll de BUK;
     se declara en el F29. Lo traemos de `/api/sii/f29/impuesto` (fuente BUK) para la
     tarjeta "Impuestos (F29)" de la Planilla. period = "YYYY-MM". */
  const [anioRaw, mesRaw] = (period ?? "").split("-");
  const anio = Number(anioRaw) || 0;
  const mes = Number(mesRaw) || 0;
  const f29ImpuestoQuery = useSiiF29Impuesto(anio, mes, undefined, Boolean(period));
  const impuestoF29 = React.useMemo<number | null | undefined>(() => {
    const d = f29ImpuestoQuery.data;
    if (!d) return undefined; // todavía no resuelto → la Planilla cae al total del payroll
    // Sin dato del período (no_disponible) → null ("En preparación"), no un 0 engañoso.
    return d.fuente_impuesto_trabajadores === "no_disponible" ? null : d.impuesto_trabajadores;
  }, [f29ImpuestoQuery.data]);

  /* Detalle por empleado (ADR-0057, owner-only). Alimenta la tabla por empleado
     de Planilla y la Conciliación de sueldos. */
  const empleados = React.useMemo(
    () => normalizePayrollDetalle(payrollDetailQuery.data),
    [payrollDetailQuery.data],
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
  /* Hay planilla del período pero el detalle por empleado no está disponible
     → la conciliación no puede cruzar. Desde el fix de auth (CC-API #542) el
     owner ya recibe el detalle; si sigue vacío es por permiso (no-owner, 403)
     o porque no hay detalle ese mes. Distinguir da un mensaje honesto. */
  const detalleForbidden =
    payrollDetailQuery.error instanceof ApiError && payrollDetailQuery.error.status === 403;
  const detalleUnavailable =
    Boolean(payrollQuery.data?.totales) && !payrollDetailQuery.isLoading && empleados.length === 0;

  /* Filtro de rango idéntico al Libro. La planilla trabaja por mes → se usa el
     mes final del rango; el hint lo aclara. */
  const periodForm = (
    <PeriodRangeFilter
      value={range}
      onChange={setRange}
      hint="La planilla se registra y concilia por mes: se usa el mes final del rango."
    />
  );

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
          <PlanillaView
            period={period}
            onPeriodChange={() => {}}
            query={payrollQuery}
            detalle={empleados}
            detalleForbidden={detalleForbidden}
            impuestoF29={impuestoF29}
            periodForm={periodForm}
          />
          {period && payrollQuery.data?.totales && (
            <PayrollSync
              period={period}
              totalLiquido={payrollQuery.data.totales.total_liquido}
              periodLabel={formatPeriodLabel(period)}
            />
          )}
        </div>
      )}
      {tab === "clasificacion" && (
        <ClasificacionCuentasLive period={period} periodForm={periodForm} />
      )}
      {tab === "conciliacion" && reconcileBoardEnabled && (
        <ConciliacionBoardLive period={period} periodForm={periodForm} />
      )}
      {tab === "conciliacion" && !reconcileBoardEnabled && (
        <ConciliacionSueldosView
          period={period}
          onPeriodChange={() => {}}
          empleados={empleados}
          movimientos={movimientos}
          loading={payrollDetailQuery.isFetching || bankQuery.isFetching}
          // Un 403/err del detalle (owner-only) NO es "error de banco" → cae en
          // detalleUnavailable ("falta el detalle"). Solo el banco es error real.
          error={bankQuery.error}
          detalleUnavailable={detalleUnavailable}
          detalleForbidden={detalleForbidden}
          periodForm={periodForm}
        />
      )}

      <EmpleadoDetalle employee={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

/* Contenedor de la clasificación de remuneraciones por cuenta (ADR-0079): trae los
   trabajadores del período + el árbol de cuentas, cablea las mutations (individual y
   masiva) y muestra la vista. La asignación es persistente (se hereda cada mes). */
function ClasificacionCuentasLive({
  period,
  periodForm,
}: {
  period: string;
  periodForm: React.ReactNode;
}) {
  const workersQuery = usePayrollWorkers(period, Boolean(period));
  const accountsQuery = useManagementAccountsTree();
  const setAlloc = useSetWorkerAllocations();
  const bulkSet = useBulkSetWorkerAllocations();

  const options = React.useMemo(
    () => payrollCuentaOptions(accountsQuery.data?.items ?? []),
    [accountsQuery.data],
  );

  // Meses "rige desde" (effective_from): el actual + 11 hacia atrás; el actual es el default.
  const months = React.useMemo(() => {
    const m = /^(\d{4})-(\d{2})$/.exec(period ?? "");
    if (!m) return [];
    const y0 = Number(m[1]);
    const mo0 = Number(m[2]);
    const out: { value: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      let yy = y0;
      let mm = mo0 - i;
      while (mm <= 0) {
        mm += 12;
        yy -= 1;
      }
      const v = `${yy}-${String(mm).padStart(2, "0")}`;
      out.push({ value: v, label: formatPeriodLabel(v) });
    }
    return out;
  }, [period]);

  const errMsg = (e: unknown) =>
    e instanceof ApiError && e.status === 403
      ? "Tu rol es de solo lectura, no puedes clasificar."
      : e instanceof ApiError && e.status === 400
        ? "El reparto no es válido (revisa las cuentas y que sume 100%)."
        : "No pudimos guardar la clasificación. Intenta de nuevo.";

  const onAssign = (workerRut: string, allocations: AllocationIn[], effectiveFrom: string) =>
    setAlloc.mutate(
      { workerRut, allocations, effectiveFrom },
      {
        onSuccess: () => toast.success("Clasificación guardada"),
        onError: (e) => toast.error("No se pudo guardar", { description: errMsg(e) }),
      },
    );
  const onBulkAssign = (workerRuts: string[], allocations: AllocationIn[], effectiveFrom: string) =>
    bulkSet.mutate(
      { workerRuts, allocations, effectiveFrom },
      {
        onSuccess: () =>
          toast.success(
            `${workerRuts.length} ${workerRuts.length === 1 ? "trabajador clasificado" : "trabajadores clasificados"}`,
          ),
        onError: (e) => toast.error("No se pudo asignar en lote", { description: errMsg(e) }),
      },
    );

  return (
    <ClasificacionCuentasView
      workers={workersQuery.data?.workers ?? []}
      options={options}
      months={months}
      unclassifiedCount={workersQuery.data?.unclassified_count ?? 0}
      loading={workersQuery.isLoading}
      error={workersQuery.error}
      pending={setAlloc.isPending || bulkSet.isPending}
      onAssign={onAssign}
      onBulkAssign={onBulkAssign}
      periodForm={periodForm}
    />
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
