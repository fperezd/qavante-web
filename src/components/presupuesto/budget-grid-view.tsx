"use client";

import * as React from "react";
import { CheckCircle2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { QavanteCard } from "@/components/qavante";
import { MESES_GRID, type BudgetGridModel, type GridSeccion } from "./budget-grid-model";

/* Grilla anual EDITABLE del Presupuesto: cuentas × 12 meses. Presentacional — recibe el modelo ya
   derivado y avisa por `onEditCell` (monto SIGNADO) cuando el dueño ajusta una celda. Bajo cada sección
   los montos se muestran en magnitud (positivos); el signo lo pone la sección. */

function fmt(n: number): string {
  const r = Math.round(n);
  return r === 0 ? "0" : Math.abs(r).toLocaleString("es-CL");
}

/** Celda editable: muestra la magnitud; al enfocar se vuelve input; al confirmar (Enter/blur) avisa el
 *  monto SIGNADO (magnitud × signo de la sección). Escape cancela. */
function Celda({
  monto,
  signo,
  disabled,
  onCommit,
}: {
  monto: number;
  signo: 1 | -1;
  disabled: boolean;
  onCommit: (montoSignado: number) => void;
}) {
  const [editando, setEditando] = React.useState(false);
  const [valor, setValor] = React.useState("");

  const abrir = () => {
    if (disabled) return;
    setValor(String(Math.abs(Math.round(monto)) || ""));
    setEditando(true);
  };

  const confirmar = () => {
    setEditando(false);
    const magnitud = Math.abs(Math.round(Number(valor.replace(/[^\d-]/g, "")) || 0));
    const nuevo = magnitud * signo;
    if (nuevo !== Math.round(monto)) onCommit(nuevo);
  };

  if (editando) {
    return (
      <input
        autoFocus
        type="text"
        inputMode="numeric"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") confirmar();
          if (e.key === "Escape") setEditando(false);
        }}
        onFocus={(e) => e.target.select()}
        className="w-24 rounded border border-brand-primary bg-surface px-1.5 py-1 text-right text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-primary"
        aria-label="Monto presupuestado"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={abrir}
      disabled={disabled}
      className={cn(
        "w-full rounded px-1.5 py-1 text-right text-xs tabular-nums text-neutral-dark",
        disabled
          ? "cursor-default"
          : "hover:bg-brand-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
      )}
    >
      {fmt(monto)}
    </button>
  );
}

function FilaResultado({ meses, total }: { meses: number[]; total: number }) {
  return (
    <tr className="border-t-2 border-border-strong bg-surface-muted/60 font-bold">
      <td className="sticky left-0 z-10 bg-surface-muted/60 px-3 py-2 text-neutral-dark">Resultado</td>
      {meses.map((m, i) => (
        <td
          key={i}
          className={cn(
            "px-1.5 py-2 text-right text-xs tabular-nums",
            m < 0 ? "text-danger-500" : "text-neutral-dark",
          )}
        >
          {m < 0 ? "−" : ""}
          {fmt(m)}
        </td>
      ))}
      <td
        className={cn(
          "px-3 py-2 text-right text-xs tabular-nums",
          total < 0 ? "text-danger-500" : "text-neutral-dark",
        )}
      >
        {total < 0 ? "−" : ""}
        {fmt(total)}
      </td>
    </tr>
  );
}

export interface BudgetGridViewProps {
  model: BudgetGridModel;
  onEditCell: (accountId: string | null, impact: string, month: number, montoSignado: number) => void;
  onAccept: () => void;
  saving?: boolean;
  accepting?: boolean;
  className?: string;
}

export function BudgetGridView({
  model,
  onEditCell,
  onAccept,
  saving = false,
  accepting = false,
  className,
}: BudgetGridViewProps) {
  const publicado = model.accepted;

  return (
    <QavanteCard variant="bordered" className={cn("overflow-hidden p-0", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-neutral-dark">Tu presupuesto {model.year}, mes a mes</span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
              publicado
                ? "bg-success-700/10 text-success-700"
                : "bg-amber-100 text-amber-700",
            )}
          >
            {publicado ? (
              <>
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Aceptado
              </>
            ) : (
              "Borrador"
            )}
          </span>
          {saving && <span className="text-[11px] text-neutral-mid">Guardando…</span>}
        </div>
        {!publicado && (
          <button
            type="button"
            onClick={onAccept}
            disabled={accepting || !model.status}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {accepting ? "Aceptando…" : "Aceptar presupuesto"}
          </button>
        )}
      </div>

      <p className="px-4 pt-2 text-xs text-neutral-mid">
        {publicado ? (
          <>
            <Lock className="mr-1 inline h-3 w-3 align-[-1px]" aria-hidden="true" />
            Aceptado. Al editar una celda vuelve a borrador (siempre puedes ajustarlo).
          </>
        ) : (
          "Toca cualquier celda para ajustar el monto. Las cuentas de costo y gasto van en positivo."
        )}
      </p>

      <div className="overflow-x-auto px-2 py-2">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-neutral-mid">
              <th className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-semibold">Cuenta</th>
              {MESES_GRID.map((m) => (
                <th key={m} className="px-1.5 py-2 text-right font-semibold">
                  {m}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold text-brand-primary">Año</th>
            </tr>
          </thead>
          <tbody>
            {model.secciones.map((sec) => (
              <Seccion
                key={sec.impact}
                sec={sec}
                disabled={saving}
                onEditCell={onEditCell}
              />
            ))}
            <FilaResultado meses={model.resultadoMeses} total={model.resultadoAnio} />
          </tbody>
        </table>
      </div>
    </QavanteCard>
  );
}

function Seccion({
  sec,
  disabled,
  onEditCell,
}: {
  sec: GridSeccion;
  disabled: boolean;
  onEditCell: BudgetGridViewProps["onEditCell"];
}) {
  return (
    <>
      <tr className="bg-surface-muted/40 text-[11px] font-bold uppercase tracking-wider text-neutral-mid">
        <td className="sticky left-0 z-10 bg-surface-muted/40 px-3 py-1.5">{sec.label}</td>
        {sec.subtotalMeses.map((m, i) => (
          <td key={i} className="px-1.5 py-1.5 text-right tabular-nums text-neutral-dark">
            {fmt(m)}
          </td>
        ))}
        <td className="px-3 py-1.5 text-right tabular-nums text-neutral-dark">{fmt(sec.totalAnio)}</td>
      </tr>
      {sec.filas.length === 0 ? (
        <tr>
          <td colSpan={14} className="sticky left-0 px-3 py-1.5 text-xs italic text-neutral-mid">
            Sin cuentas en esta sección.
          </td>
        </tr>
      ) : (
        sec.filas.map((fila) => (
          <tr key={`${sec.impact}:${fila.accountId ?? fila.name}`} className="border-b border-border/40">
            <td className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-neutral-dark">
              {fila.name}
            </td>
            {fila.meses.map((monto, i) => (
              <td key={i} className="py-0.5">
                <Celda
                  monto={monto}
                  signo={sec.signo}
                  disabled={disabled}
                  onCommit={(montoSignado) =>
                    onEditCell(fila.accountId, fila.impact, i + 1, montoSignado)
                  }
                />
              </td>
            ))}
            <td className="px-3 py-1.5 text-right text-xs tabular-nums font-medium text-neutral-dark">
              {fmt(fila.totalAnio)}
            </td>
          </tr>
        ))
      )}
    </>
  );
}
