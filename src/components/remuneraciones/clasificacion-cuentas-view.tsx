"use client";

import * as React from "react";
import { Inbox, ListChecks, TriangleAlert, Pencil } from "lucide-react";
import {
  QavanteBadge,
  QavanteButton,
  QavanteCard,
  QavanteEmpty,
  QavanteInlineError,
} from "@/components/qavante";
import { stickyScroll, stickyHead } from "@/components/table/sticky-table";
import { SortHeader } from "@/components/qavante/sort-header";
import { useTableSort, type SortColumn } from "@/lib/hooks/use-table-sort";
import { formatClp } from "@/lib/formatters/clp";
import { formatRut } from "@/lib/formatters/rut";
import { cn } from "@/lib/utils";
import type { WorkerClassification, AllocationIn, AllocationOut } from "@/lib/api/payroll-workers";
import { AllocationEditorDialog } from "./allocation-editor-dialog";
import type { CuentaOption } from "./payroll-cuentas";

/* Clasificación de remuneraciones por empleado (ADR-0079 v2, #743). Tabla estilo
   Chipax: cada trabajador (ordenado por costo desc) reparte su costo en 1..N cuentas
   por % (costo de servicio / gasto), individual o en lote, con un mes DESDE EL QUE
   rige (backdating). Presentacional: el contenedor pasa datos + opciones + meses +
   handlers (las mutations viven en `payroll-workers`). */

export interface ClasificacionCuentasViewProps {
  workers: WorkerClassification[];
  options: CuentaOption[];
  /** Meses "rige desde" (YYYY-MM, más nuevo primero); el primero es el default. */
  months: { value: string; label: string }[];
  unclassifiedCount: number;
  loading?: boolean;
  error?: unknown;
  /** Solo owner/admin pueden asignar; de solo lectura → sin botones de edición. */
  canEdit?: boolean;
  pending?: boolean;
  onAssign: (workerRut: string, allocations: AllocationIn[], effectiveFrom: string) => void;
  onBulkAssign: (workerRuts: string[], allocations: AllocationIn[], effectiveFrom: string) => void;
  periodForm?: React.ReactNode;
}

function parseMonto(raw: string): number {
  return Number(raw) || 0;
}

/** Reparto actual como texto: "Sin clasificar" / la cuenta (1 al 100%) / "60% A · 40% B". */
function ResumenAlloc({ allocations }: { allocations?: AllocationOut[] | null }) {
  if (!allocations || allocations.length === 0)
    return <span className="font-medium text-warning-700">Sin clasificar</span>;
  if (allocations.length === 1) {
    const a = allocations[0]!;
    return <span className="text-neutral-dark">{a.account_name ?? a.account_code}</span>;
  }
  return (
    <span className="text-neutral-dark">
      {allocations
        .map((a) => `${Math.round(Number(a.pct))}% ${a.account_name ?? a.account_code}`)
        .join(" · ")}
    </span>
  );
}

/** AllocationOut[] → AllocationIn[] (para prellenar el diálogo al editar). */
function toIn(allocations?: AllocationOut[] | null): AllocationIn[] {
  return (allocations ?? []).map((a) => ({ account_code: a.account_code, pct: Number(a.pct) }));
}

type DialogState =
  | { modo: "cerrado" }
  | { modo: "individual"; worker: WorkerClassification }
  | { modo: "lote"; ruts: string[] };

export function ClasificacionCuentasView({
  workers,
  options,
  months,
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
  const [dialog, setDialog] = React.useState<DialogState>({ modo: "cerrado" });

  // Grilla ordenable (regla de producto). Default curado = costo empresa desc
  // (el más caro arriba, que es donde primero conviene clasificar bien).
  const sortCols = React.useMemo<SortColumn<WorkerClassification>[]>(
    () => [
      { key: "empleado", kind: "text", get: (w) => w.worker_name ?? w.worker_rut },
      { key: "costo", kind: "number", get: (w) => parseMonto(w.costo_empresa) },
    ],
    [],
  );
  const sort = useTableSort(sortCols, "costo");
  const sortedWorkers = React.useMemo(() => sort.sorted(workers), [sort, workers]);

  // Al cambiar la lista (otro período), limpiar la selección.
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

  const cerrar = () => setDialog({ modo: "cerrado" });
  const guardar = (allocations: AllocationIn[], effectiveFrom: string) => {
    if (dialog.modo === "individual")
      onAssign(dialog.worker.worker_rut, allocations, effectiveFrom);
    else if (dialog.modo === "lote") onBulkAssign(dialog.ruts, allocations, effectiveFrom);
    setChecked(new Set());
    cerrar();
  };

  const dialogInitial = dialog.modo === "individual" ? toIn(dialog.worker.allocations) : [];
  const dialogTitle =
    dialog.modo === "individual"
      ? `Clasificar a ${dialog.worker.worker_name ?? dialog.worker.worker_rut}`
      : dialog.modo === "lote"
        ? `Clasificar ${dialog.ruts.length} ${dialog.ruts.length === 1 ? "trabajador" : "trabajadores"}`
        : "";
  const dialogSubtitle =
    dialog.modo === "individual" ? (
      <>Costo empresa: {formatClp(parseMonto(dialog.worker.costo_empresa))}</>
    ) : undefined;
  // Solo en individual hay un costo único que repartir → mostramos los $ por fila.
  const dialogBase =
    dialog.modo === "individual" ? parseMonto(dialog.worker.costo_empresa) : undefined;

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
            Asigna cada persona a una cuenta: <b>costo de servicio</b> (quien entrega el servicio,
            sube el margen) o <b>gasto</b> (administración). Puedes repartir en varias (split) y
            elegir desde qué mes rige. La asignación se hereda a los meses siguientes.
          </p>

          {/* Barra de acción en lote. */}
          {canEdit && checked.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand-primary/30 bg-brand-primary-50 px-3 py-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-deep">
                <ListChecks className="size-4 text-brand-primary" aria-hidden="true" />
                {checked.size} seleccionado{checked.size === 1 ? "" : "s"}
              </span>
              <div className="ml-auto">
                <QavanteButton
                  size="sm"
                  onClick={() => setDialog({ modo: "lote", ruts: [...checked] })}
                  disabled={pending}
                >
                  Clasificar {checked.size}
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
                    <SortHeader
                      label="Empleado"
                      active={sort.sortKey === "empleado"}
                      dir={sort.sortDir}
                      onClick={() => sort.toggle("empleado")}
                    />
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">
                    <SortHeader
                      label="Costo empresa"
                      align="right"
                      active={sort.sortKey === "costo"}
                      dir={sort.sortDir}
                      onClick={() => sort.toggle("costo")}
                    />
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Clasificación
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedWorkers.map((w) => (
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
                    <td className="py-2 pr-3 text-[12.5px]">
                      <ResumenAlloc allocations={w.allocations} />
                    </td>
                    <td className="py-2 text-right">
                      {canEdit && (
                        <QavanteButton
                          size="sm"
                          variant="secondary"
                          onClick={() => setDialog({ modo: "individual", worker: w })}
                          disabled={pending}
                          aria-label={`Clasificar a ${w.worker_name ?? w.worker_rut}`}
                        >
                          <Pencil className="mr-1 size-3.5" aria-hidden="true" />
                          {w.allocations && w.allocations.length > 0 ? "Editar" : "Clasificar"}
                        </QavanteButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QavanteCard>
      )}

      <AllocationEditorDialog
        open={dialog.modo !== "cerrado"}
        onClose={cerrar}
        title={dialogTitle}
        subtitle={dialogSubtitle}
        options={options}
        initial={dialogInitial}
        months={months}
        baseAmount={dialogBase}
        pending={pending}
        onSave={guardar}
      />
    </div>
  );
}
