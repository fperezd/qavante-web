"use client";

import * as React from "react";
import { Inbox, ListChecks, TriangleAlert } from "lucide-react";
import {
  QavanteBadge,
  QavanteButton,
  QavanteCard,
  QavanteEmpty,
  QavanteInlineError,
} from "@/components/qavante";
import { stickyScroll, stickyHead } from "@/components/table/sticky-table";
import { formatClp } from "@/lib/formatters/clp";
import { formatRut } from "@/lib/formatters/rut";
import { cn } from "@/lib/utils";
import type { WorkerClassification } from "@/lib/api/payroll-workers";
import { agruparCuentaOptions, type CuentaOption } from "./payroll-cuentas";

/* Clasificación de remuneraciones por empleado (ADR-0079). Tabla estilo Chipax:
   cada trabajador (ordenado por costo desc) se asigna a una cuenta del plan
   —costo de servicio (sube el margen) o gasto—, individual o en lote. La
   asignación es persistente (se hereda cada mes). Presentacional: el contenedor
   pasa los datos + handlers (las mutations viven en `payroll-workers`). */

export interface ClasificacionCuentasViewProps {
  workers: WorkerClassification[];
  options: CuentaOption[];
  unclassifiedCount: number;
  loading?: boolean;
  error?: unknown;
  /** Solo owner/admin pueden asignar; si es de solo lectura se deshabilitan los selects. */
  canEdit?: boolean;
  pending?: boolean;
  onAssign: (workerRut: string, accountCode: string) => void;
  onBulkAssign: (workerRuts: string[], accountCode: string) => void;
  /** Selector de período (reusado del contenedor). */
  periodForm?: React.ReactNode;
}

function parseMonto(raw: string): number {
  return Number(raw) || 0;
}

/** Select de cuenta con optgroups (costo / gasto). "Sin clasificar" es placeholder
    no seleccionable: el contrato no permite des-asignar (solo cambiar de cuenta). */
function CuentaSelect({
  value,
  options,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: string | null | undefined;
  options: CuentaOption[];
  onChange: (code: string) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  const grupos = agruparCuentaOptions(options);
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => {
        const code = e.target.value;
        if (code) onChange(code);
      }}
      className={cn(
        "w-full max-w-[280px] rounded-md border bg-surface px-2 py-1 text-[12.5px] text-neutral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-50",
        value ? "border-border" : "border-warning-500/50 bg-warning-500/[.04]",
      )}
    >
      <option value="" disabled>
        Sin clasificar
      </option>
      {grupos.map((g) => (
        <optgroup key={g.grupo} label={g.label}>
          {g.options.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function ClasificacionCuentasView({
  workers,
  options,
  unclassifiedCount,
  loading,
  error,
  canEdit = true,
  pending,
  onAssign,
  onBulkAssign,
  periodForm,
}: ClasificacionCuentasViewProps) {
  const [checked, setChecked] = React.useState<Set<string>>(new Set());
  const [bulkAccount, setBulkAccount] = React.useState("");

  // Al cambiar la lista (otro período), limpiar la selección para no arrastrar RUTs viejos.
  const rutsKey = workers.map((w) => w.worker_rut).join(",");
  React.useEffect(() => {
    setChecked(new Set());
  }, [rutsKey]);

  const toggle = (rut: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(rut)) next.delete(rut);
      else next.add(rut);
      return next;
    });
  const allChecked = workers.length > 0 && workers.every((w) => checked.has(w.worker_rut));
  const toggleAll = () =>
    setChecked(allChecked ? new Set() : new Set(workers.map((w) => w.worker_rut)));

  const runBulk = () => {
    if (!bulkAccount || checked.size === 0) return;
    onBulkAssign([...checked], bulkAccount);
    setChecked(new Set());
    setBulkAccount("");
  };

  return (
    <div className="space-y-3">
      {periodForm}

      {error ? (
        <QavanteInlineError error={error} what="la clasificación de remuneraciones" />
      ) : loading ? (
        <div
          className="h-40 animate-pulse rounded-xl bg-neutral-light/30"
          aria-busy="true"
          aria-label="Cargando trabajadores"
        />
      ) : workers.length === 0 ? (
        <QavanteEmpty
          icon={Inbox}
          title="Sin remuneraciones en el período"
          description="No hay trabajadores con costo en este mes. Prueba con otro período."
        />
      ) : (
        <QavanteCard
          variant="bordered"
          header={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">Clasificación por empleado</span>
              {unclassifiedCount > 0 ? (
                <QavanteBadge variant="warning">
                  <TriangleAlert className="mr-1 inline size-3" aria-hidden="true" />
                  {unclassifiedCount} sin clasificar
                </QavanteBadge>
              ) : (
                <QavanteBadge variant="success">Todos clasificados</QavanteBadge>
              )}
            </div>
          }
        >
          <p className="mb-3 text-[12.5px] text-neutral-mid">
            Asigná cada persona a una cuenta: <b>costo de servicio</b> (quien entrega el servicio,
            sube el margen) o <b>gasto</b> (administración, bajo el margen). Se asigna una vez y se
            hereda cada mes. Lo que quede sin clasificar cae en gasto admin (no infla el margen).
          </p>

          {/* Barra de acción en lote. */}
          {canEdit && checked.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand-primary/30 bg-brand-primary-50 px-3 py-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-deep">
                <ListChecks className="size-4 text-brand-primary" aria-hidden="true" />
                {checked.size} seleccionado{checked.size === 1 ? "" : "s"}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <CuentaSelect
                  value={bulkAccount || null}
                  options={options}
                  onChange={setBulkAccount}
                  disabled={pending}
                  ariaLabel="Cuenta para los seleccionados"
                />
                <QavanteButton size="sm" onClick={runBulk} disabled={pending || !bulkAccount}>
                  Asignar a {checked.size}
                </QavanteButton>
              </div>
            </div>
          )}

          <div className={stickyScroll}>
            <table className="w-full min-w-[560px] text-sm">
              <thead className={stickyHead}>
                <tr className="border-b border-border-strong text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                  {canEdit && (
                    <th scope="col" className="w-8 py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={toggleAll}
                        className="size-4 accent-brand-primary"
                        aria-label="Seleccionar todos los trabajadores"
                      />
                    </th>
                  )}
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Empleado
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">
                    Costo empresa
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Cuenta
                  </th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr
                    key={w.worker_rut}
                    className={cn(
                      "border-b border-border/60 transition-colors last:border-b-0 hover:bg-surface-muted",
                      checked.has(w.worker_rut) && "bg-brand-primary-50/50",
                    )}
                  >
                    {canEdit && (
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={checked.has(w.worker_rut)}
                          onChange={() => toggle(w.worker_rut)}
                          className="size-4 accent-brand-primary"
                          aria-label={`Seleccionar ${w.worker_name ?? w.worker_rut}`}
                        />
                      </td>
                    )}
                    <td className="py-2 pr-3">
                      <span className="block text-neutral-dark">
                        {w.worker_name ?? "Sin nombre"}
                      </span>
                      <span className="block font-mono text-xs text-neutral-mid">
                        {formatRut(w.worker_rut)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums font-medium text-neutral-dark">
                      {formatClp(parseMonto(w.costo_empresa))}
                    </td>
                    <td className="py-2">
                      <CuentaSelect
                        value={w.account_code}
                        options={options}
                        onChange={(code) => onAssign(w.worker_rut, code)}
                        disabled={!canEdit || pending}
                        ariaLabel={`Cuenta de ${w.worker_name ?? w.worker_rut}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QavanteCard>
      )}
    </div>
  );
}
