"use client";

import * as React from "react";
import { Landmark, CheckCircle2, UserX, HelpCircle, Inbox } from "lucide-react";
import { QavanteBadge, QavanteCard, QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import { SortHeader } from "@/components/qavante/sort-header";
import { useTableSort, type SortColumn } from "@/lib/hooks/use-table-sort";
import { formatClp } from "@/lib/formatters/clp";
import { formatRut } from "@/lib/formatters/rut";
import { formatDateLike } from "@/lib/formatters/date";
import { SiiPeriodForm } from "@/components/sii/sii-period-form";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import type { EmployeePayroll } from "./payroll-detalle";
import {
  matchPayrollToBank,
  resumenConciliacion,
  type BankDebitLike,
} from "./payroll-conciliacion";

/* Conciliación de sueldos — cruza el líquido por empleado (payroll) contra los
   débitos de la cartola bancaria del período. Presentacional: recibe los dos
   conjuntos ya resueltos. El match es por monto (ver payroll-conciliacion.ts). */

export interface ConciliacionSueldosViewProps {
  period: string | null;
  onPeriodChange: (period: string) => void;
  /** Líquidos por empleado (payroll detalle). [] si el backend no lo expone aún. */
  empleados: EmployeePayroll[];
  /** Movimientos bancarios del período. */
  movimientos: BankDebitLike[];
  loading?: boolean;
  error?: unknown;
  /** `true` si el payroll no trae `detalle` por empleado. */
  detalleUnavailable?: boolean;
  /** `true` si el detalle vino 403 (owner-only): distingue "solo para el dueño"
   *  de "sin dato del período". Desde CC-API #542 el owner ya no recibe 403. */
  detalleForbidden?: boolean;
  /** Selector de período custom (filtro de rango). Reemplaza al SiiPeriodForm. */
  periodForm?: React.ReactNode;
}

export function ConciliacionSueldosView({
  period,
  onPeriodChange,
  empleados,
  movimientos,
  loading = false,
  error = null,
  detalleUnavailable = false,
  detalleForbidden = false,
  periodForm,
}: ConciliacionSueldosViewProps) {
  const result = React.useMemo(
    () => matchPayrollToBank(empleados, movimientos),
    [empleados, movimientos],
  );
  const resumen = resumenConciliacion(result);

  return (
    <div className="space-y-4">
      {periodForm ?? (
        <SiiPeriodForm
          onSubmit={onPeriodChange}
          loading={loading}
          hint="Cruza el líquido de cada trabajador contra los débitos de sueldos del banco del mes."
        />
      )}

      {!period && (
        <QavanteEmpty
          icon={Landmark}
          title="Concilia los sueldos del período"
          description="Elige un mes: vamos a cruzar el líquido de cada trabajador contra los débitos de la cartola bancaria y mostrarte qué está conciliado y qué falta."
        />
      )}

      {period && loading && (
        <div
          className="h-32 animate-pulse rounded-xl bg-neutral-light/30"
          aria-busy="true"
          aria-label="Conciliando sueldos"
        />
      )}

      {period && !loading && error != null && (
        <QavanteInlineError error={error} what="los movimientos bancarios" />
      )}

      {period && !loading && error == null && detalleUnavailable && (
        <QavanteEmpty
          icon={HelpCircle}
          title={detalleForbidden ? "Detalle solo para el dueño" : "Falta el detalle por empleado"}
          description={
            detalleForbidden
              ? "La conciliación necesita el líquido de cada trabajador. Ese detalle por empleado es visible solo para el dueño de la cuenta."
              : "La conciliación necesita el líquido de cada trabajador, y no hay detalle por empleado para este período. Cuando el conector lo traiga, esta pantalla cruza sola contra el banco."
          }
        />
      )}

      {period && !loading && error == null && !detalleUnavailable && empleados.length === 0 && (
        <QavanteEmpty
          icon={Inbox}
          title="Sin planilla en el período"
          description="No hay líquidos por empleado para este mes. Prueba con otro período."
        />
      )}

      {period && !loading && error == null && !detalleUnavailable && empleados.length > 0 && (
        <>
          <ResumenCard period={period} resumen={resumen} />
          {result.matched.length > 0 && <ConciliadosTable matched={result.matched} />}
          {result.unmatchedEmpleados.length > 0 && (
            <PendientesTable empleados={result.unmatchedEmpleados} />
          )}
          {result.unmatchedDebitos.length > 0 && (
            <DebitosSinAsignarTable debitos={result.unmatchedDebitos} />
          )}
          <p className="text-xs text-neutral-mid">
            El cruce es por monto (líquido = débito), 1 a 1. Es una ayuda de conciliación: revisa
            antes de dar por pagado. Fuente: Remuneraciones (BUK) + cartola del banco.
          </p>
        </>
      )}
    </div>
  );
}

function ResumenCard({
  period,
  resumen,
}: {
  period: string;
  resumen: ReturnType<typeof resumenConciliacion>;
}) {
  const todosOk = resumen.empleadosPendientes === 0 && resumen.debitosSinAsignar === 0;
  return (
    <QavanteCard variant="bordered">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-mid">
            {formatPeriodLabel(period)}
          </p>
          <p className="mt-1 text-lg font-semibold text-neutral-dark">
            {resumen.conciliados} de {resumen.totalEmpleados} empleados conciliados
          </p>
          <p className="text-sm tabular-nums text-neutral-mid">
            Conciliado: <span className="font-medium">{formatClp(resumen.montoConciliado)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {todosOk ? (
            <QavanteBadge variant="success">
              <CheckCircle2 className="mr-1 inline h-3 w-3" aria-hidden="true" />
              Todo conciliado
            </QavanteBadge>
          ) : (
            <>
              {resumen.empleadosPendientes > 0 && (
                <QavanteBadge variant="warning">
                  {resumen.empleadosPendientes} sin pagar
                </QavanteBadge>
              )}
              {resumen.debitosSinAsignar > 0 && (
                <QavanteBadge variant="default">
                  {resumen.debitosSinAsignar} débito(s) sin asignar
                </QavanteBadge>
              )}
            </>
          )}
        </div>
      </div>
    </QavanteCard>
  );
}

type Matched = ReturnType<typeof matchPayrollToBank>["matched"];

function ConciliadosTable({ matched }: { matched: Matched }) {
  const cols = React.useMemo<SortColumn<Matched[number]>[]>(
    () => [
      { key: "empleado", kind: "text", get: (m) => m.empleado.nombre },
      { key: "liquido", kind: "number", get: (m) => m.empleado.liquido },
      { key: "debito", kind: "date", get: (m) => m.movimiento.date },
    ],
    [],
  );
  const sort = useTableSort(cols, "empleado");
  const rows = React.useMemo(() => sort.sorted(matched), [sort, matched]);
  return (
    <Section icon={CheckCircle2} title="Conciliados" count={matched.length} tone="success">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border-strong text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
            <th className="py-2 pr-3 font-semibold">
              <SortHeader
                label="Empleado"
                active={sort.sortKey === "empleado"}
                dir={sort.sortDir}
                onClick={() => sort.toggle("empleado")}
              />
            </th>
            <th className="py-2 pr-3 font-semibold">RUT</th>
            <th className="py-2 pr-3 text-right font-semibold">
              <SortHeader
                label="Líquido"
                align="right"
                active={sort.sortKey === "liquido"}
                dir={sort.sortDir}
                onClick={() => sort.toggle("liquido")}
              />
            </th>
            <th className="py-2 pr-3 font-semibold">
              <SortHeader
                label="Débito banco"
                active={sort.sortKey === "debito"}
                dir={sort.sortDir}
                onClick={() => sort.toggle("debito")}
              />
            </th>
            <th className="py-2 font-semibold">Glosa</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ empleado, movimiento }, i) => (
            <tr
              key={`${empleado.id}-${movimiento.id}-${i}`}
              className="border-b border-border/60 last:border-b-0"
            >
              <td className="py-2 pr-3 text-neutral-dark">{empleado.nombre}</td>
              <td className="py-2 pr-3 font-mono text-xs text-neutral-mid">
                {empleado.rut ? formatRut(empleado.rut) : "—"}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums font-medium text-neutral-dark">
                {empleado.liquido !== null ? formatClp(empleado.liquido) : "—"}
              </td>
              <td className="py-2 pr-3 text-neutral-mid">{formatDateLike(movimiento.date)}</td>
              <td className="py-2 truncate text-xs text-neutral-mid">
                {movimiento.description ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function PendientesTable({ empleados }: { empleados: EmployeePayroll[] }) {
  const cols = React.useMemo<SortColumn<EmployeePayroll>[]>(
    () => [
      { key: "empleado", kind: "text", get: (e) => e.nombre },
      { key: "liquido", kind: "number", get: (e) => e.liquido },
    ],
    [],
  );
  // Default: líquido desc → el sueldo más grande sin pagar arriba (lo más urgente).
  const sort = useTableSort(cols, "liquido");
  const rows = React.useMemo(() => sort.sorted(empleados), [sort, empleados]);
  return (
    <Section icon={UserX} title="Empleados sin débito" count={empleados.length} tone="warning">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-border-strong text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
            <th className="py-2 pr-3 font-semibold">
              <SortHeader
                label="Empleado"
                active={sort.sortKey === "empleado"}
                dir={sort.sortDir}
                onClick={() => sort.toggle("empleado")}
              />
            </th>
            <th className="py-2 pr-3 font-semibold">RUT</th>
            <th className="py-2 text-right font-semibold">
              <SortHeader
                label="Líquido"
                align="right"
                active={sort.sortKey === "liquido"}
                dir={sort.sortDir}
                onClick={() => sort.toggle("liquido")}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e, i) => (
            <tr key={`${e.id}-${i}`} className="border-b border-border/60 last:border-b-0">
              <td className="py-2 pr-3 text-neutral-dark">{e.nombre}</td>
              <td className="py-2 pr-3 font-mono text-xs text-neutral-mid">
                {e.rut ? formatRut(e.rut) : "—"}
              </td>
              <td className="py-2 text-right tabular-nums text-neutral-dark">
                {e.liquido !== null ? formatClp(e.liquido) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function DebitosSinAsignarTable({ debitos }: { debitos: BankDebitLike[] }) {
  const cols = React.useMemo<SortColumn<BankDebitLike>[]>(
    () => [
      { key: "fecha", kind: "date", get: (d) => d.date },
      { key: "monto", kind: "number", get: (d) => Math.abs(Number(d.amount) || 0) },
    ],
    [],
  );
  // Default: fecha desc (débito más reciente arriba, regla de grillas por fecha).
  const sort = useTableSort(cols, "fecha");
  const rows = React.useMemo(() => sort.sorted(debitos), [sort, debitos]);
  return (
    <Section icon={HelpCircle} title="Débitos sin empleado" count={debitos.length} tone="muted">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-border-strong text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
            <th className="py-2 pr-3 font-semibold">
              <SortHeader
                label="Fecha"
                active={sort.sortKey === "fecha"}
                dir={sort.sortDir}
                onClick={() => sort.toggle("fecha")}
              />
            </th>
            <th className="py-2 pr-3 font-semibold">Glosa</th>
            <th className="py-2 text-right font-semibold">
              <SortHeader
                label="Monto"
                align="right"
                active={sort.sortKey === "monto"}
                dir={sort.sortDir}
                onClick={() => sort.toggle("monto")}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d, i) => (
            <tr key={`${d.id}-${i}`} className="border-b border-border/60 last:border-b-0">
              <td className="py-2 pr-3 text-neutral-mid">{formatDateLike(d.date)}</td>
              <td className="py-2 pr-3 text-neutral-dark">{d.description ?? "—"}</td>
              <td className="py-2 text-right tabular-nums text-neutral-dark">
                {formatClp(Math.abs(Number(d.amount) || 0))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function Section({
  icon: Icon,
  title,
  count,
  tone,
  children,
}: {
  icon: typeof CheckCircle2;
  title: string;
  count: number;
  tone: "success" | "warning" | "muted";
  children: React.ReactNode;
}) {
  const color =
    tone === "success"
      ? "text-success-600"
      : tone === "warning"
        ? "text-warning-700"
        : "text-neutral-mid";
  return (
    <QavanteCard variant="bordered">
      <div className="space-y-2">
        <h3 className={"flex items-center gap-1.5 text-sm font-semibold " + color}>
          <Icon className="h-4 w-4" aria-hidden="true" />
          {title}
          <span className="text-neutral-mid">({count})</span>
        </h3>
        <div className="overflow-x-auto">{children}</div>
      </div>
    </QavanteCard>
  );
}
