"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Plus, X, TriangleAlert } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import { cn } from "@/lib/utils";
import { formatClp } from "@/lib/formatters/clp";
import { agruparCuentaOptions, type CuentaOption } from "./payroll-cuentas";
import type { AllocationIn } from "@/lib/api/payroll-workers";

/* Editor de reparto de nómina (ADR-0079 v2, #743). Reparte el costo de un empleado
   (o de varios, en lote) en 1..N cuentas por % (Σ = 100; el caso simple = 1 cuenta
   al 100%). Y elige DESDE QUÉ MES rige (`effective_from`): dejarlo en el mes actual
   = de acá en adelante; elegir un mes anterior = clasificar hacia atrás hasta ahí
   (los meses previos quedan igual). Presentacional: el contenedor pasa opciones +
   meses + handler. */

export interface AllocationEditorDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  options: CuentaOption[];
  /** Reparto inicial (para editar uno ya clasificado). Vacío → arranca con 1 fila. */
  initial?: AllocationIn[];
  /** Meses "rige desde" (YYYY-MM, más nuevo primero). El primero es el default. */
  months: { value: string; label: string }[];
  /** Costo empresa a repartir (solo en modo individual): muestra los $ por fila
   *  además del %. En lote no aplica (son varios costos distintos) → undefined. */
  baseAmount?: number;
  pending?: boolean;
  onSave: (allocations: AllocationIn[], effectiveFrom: string) => void;
}

interface Row {
  account_code: string;
  pct: string;
}

function CuentaOptions({ options }: { options: CuentaOption[] }) {
  return (
    <>
      <option value="" disabled>
        Elegir cuenta…
      </option>
      {agruparCuentaOptions(options).map((g) => (
        <optgroup key={g.grupo} label={g.label}>
          {g.options.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

export function AllocationEditorDialog({
  open,
  onClose,
  title,
  subtitle,
  options,
  initial,
  months,
  baseAmount,
  pending,
  onSave,
}: AllocationEditorDialogProps) {
  const initialRows = (): Row[] =>
    initial && initial.length > 0
      ? initial.map((a) => ({ account_code: a.account_code, pct: String(a.pct) }))
      : [{ account_code: "", pct: "100" }];
  const [rows, setRows] = React.useState<Row[]>(initialRows);
  const [effectiveFrom, setEffectiveFrom] = React.useState(months[0]?.value ?? "");

  // Reiniciar al (re)abrir para no arrastrar el estado del trabajador anterior.
  React.useEffect(() => {
    if (open) {
      setRows(initialRows());
      setEffectiveFrom(months[0]?.value ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const total = rows.reduce((s, r) => s + (Number(r.pct) || 0), 0);
  const dupCuenta =
    new Set(rows.filter((r) => r.account_code).map((r) => r.account_code)).size <
    rows.filter((r) => r.account_code).length;
  const completo = rows.every((r) => r.account_code && Number(r.pct) > 0);
  const sumaOk = Math.abs(total - 100) < 0.01;
  const valido = completo && sumaOk && !dupCuenta && Boolean(effectiveFrom);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((prev) => [...prev, { account_code: "", pct: "" }]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, j) => j !== i));

  const guardar = () => {
    if (!valido) return;
    onSave(
      rows.map((r) => ({ account_code: r.account_code, pct: Number(r.pct) })),
      effectiveFrom,
    );
  };

  const selectCls =
    "min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-[12.5px] text-neutral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-50";

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-brand-deep/40 backdrop-blur-sm data-[open]:animate-in data-[closed]:animate-out" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border-strong bg-surface p-5 shadow-xl data-[open]:animate-in data-[closed]:animate-out">
          <Dialog.Title className="text-lg font-semibold text-neutral-dark">{title}</Dialog.Title>
          {subtitle && <p className="mt-0.5 text-[12.5px] text-neutral-mid">{subtitle}</p>}

          <p className="mt-3 text-[12px] text-neutral-mid">
            Repartí el costo en una o más cuentas (la suma debe dar 100%). Costo de servicio sube el
            margen; gasto va debajo.
          </p>

          {/* Filas de reparto. */}
          <div className="mt-3 space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={r.account_code}
                  onChange={(e) => setRow(i, { account_code: e.target.value })}
                  disabled={pending}
                  aria-label={`Cuenta del reparto ${i + 1}`}
                  className={selectCls}
                >
                  <CuentaOptions options={options} />
                </select>
                <div className="flex shrink-0 items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    inputMode="numeric"
                    value={r.pct}
                    onChange={(e) => setRow(i, { pct: e.target.value })}
                    disabled={pending}
                    aria-label={`Porcentaje del reparto ${i + 1}`}
                    className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-right text-[12.5px] tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  />
                  <span className="text-[12.5px] text-neutral-mid">%</span>
                </div>
                {baseAmount != null && (
                  <span
                    className="w-24 shrink-0 text-right text-[11.5px] tabular-nums text-neutral-mid"
                    aria-label={`Monto del reparto ${i + 1}`}
                  >
                    {formatClp(Math.round((baseAmount * (Number(r.pct) || 0)) / 100))}
                  </span>
                )}
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    disabled={pending}
                    aria-label={`Quitar reparto ${i + 1}`}
                    className="rounded p-1 text-neutral-mid hover:text-danger-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between">
            <QavanteButton size="sm" variant="ghost" onClick={addRow} disabled={pending}>
              <Plus className="mr-1 size-3.5" aria-hidden="true" />
              Agregar cuenta (split)
            </QavanteButton>
            <span
              className={cn(
                "text-[12.5px] font-semibold tabular-nums",
                sumaOk ? "text-success-700" : "text-warning-700",
              )}
            >
              Suma: {total}%
            </span>
          </div>

          {!sumaOk && (
            <p className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-warning-700">
              <TriangleAlert className="size-3.5" aria-hidden="true" />
              La suma de los porcentajes debe dar 100%.
            </p>
          )}
          {dupCuenta && (
            <p className="mt-1 text-[11.5px] text-warning-700">
              Hay una cuenta repetida en el reparto.
            </p>
          )}

          {/* Desde qué mes rige (backdating). */}
          <label className="mt-4 block text-[12.5px] text-neutral-dark">
            Rige desde
            <select
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              disabled={pending}
              className={cn(selectCls, "mt-1 w-full")}
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-neutral-mid">
              El mes actual = de acá en adelante. Un mes anterior = clasifica hacia atrás hasta ahí.
            </span>
          </label>

          <div className="mt-5 flex justify-end gap-2">
            <QavanteButton variant="ghost" onClick={onClose} disabled={pending}>
              Cancelar
            </QavanteButton>
            <QavanteButton onClick={guardar} disabled={!valido || pending}>
              Guardar
            </QavanteButton>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
