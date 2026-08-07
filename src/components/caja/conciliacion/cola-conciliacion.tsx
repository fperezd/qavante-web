"use client";

import { ArrowRight, Check, Loader2, X } from "lucide-react";
import { QavanteBadge, QavanteButton, QavanteCard } from "@/components/qavante";
import { cn } from "@/lib/utils";
import type { FilaCola } from "./reconciliacion-cola-map";

/* Presentacional puro (slots + callbacks, sin fetch): la cola de conciliación. Cada fila enfrenta
   un movimiento del banco con el documento que el motor cree que le corresponde (score 60-90). El
   dueño confirma o descarta. La orquestación (fetch + mutaciones) vive en `cola-conciliacion-live`.
   Testeable por Storybook `play` (ADR-0018): recibe datos, no llama al backend. */

export type ColaConciliacionProps = {
  filas: FilaCola[];
  onConfirmar: (id: string) => void;
  onRechazar: (id: string) => void;
  onConciliarTodas: () => void;
  /** Ids con una mutación en curso → deshabilitan sus botones y muestran spinner. */
  pendientes: ReadonlySet<string>;
  conciliandoTodas: boolean;
};

export function ColaConciliacion({
  filas,
  onConfirmar,
  onRechazar,
  onConciliarTodas,
  pendientes,
  conciliandoTodas,
}: ColaConciliacionProps) {
  const total = filas.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-mid">
          {total === 1
            ? "Hay 1 movimiento que calza con un documento, pero no con certeza. Revísalo."
            : `Hay ${total} movimientos que calzan con un documento, pero no con certeza. Revísalos.`}
        </p>
        <QavanteButton
          size="sm"
          onClick={onConciliarTodas}
          loading={conciliandoTodas}
          disabled={total === 0}
        >
          Conciliar todas ({total})
        </QavanteButton>
      </div>

      <ul className="space-y-3">
        {filas.map((fila) => (
          <li key={fila.id}>
            <FilaConciliacion
              fila={fila}
              onConfirmar={() => onConfirmar(fila.id)}
              onRechazar={() => onRechazar(fila.id)}
              pendiente={pendientes.has(fila.id) || conciliandoTodas}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilaConciliacion({
  fila,
  onConfirmar,
  onRechazar,
  pendiente,
}: {
  fila: FilaCola;
  onConfirmar: () => void;
  onRechazar: () => void;
  pendiente: boolean;
}) {
  return (
    <QavanteCard variant="bordered">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Lo que muestra el banco */}
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-neutral-mid">En el banco</p>
          <p
            className={cn(
              "text-lg font-semibold tabular-nums",
              fila.esCobro ? "text-success-700" : "text-neutral-dark",
            )}
          >
            {fila.montoTexto}
          </p>
          <p className="truncate text-sm text-neutral-dark" title={fila.glosaBanco}>
            {fila.glosaBanco}
          </p>
          <p className="text-xs text-neutral-mid">{fila.fecha}</p>
        </div>

        <ArrowRight
          className="hidden h-4 w-4 shrink-0 text-neutral-mid sm:block"
          aria-hidden="true"
        />

        {/* Lo que Qavante cree que es */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-wide text-neutral-mid">Parece ser</p>
            {fila.scoreTexto !== "" && (
              <QavanteBadge variant="info">{fila.scoreTexto} de certeza</QavanteBadge>
            )}
          </div>
          <p
            className={cn(
              "truncate text-sm font-medium text-neutral-dark",
              !fila.tieneNombre && "italic text-neutral-mid",
            )}
            title={fila.contraparte}
          >
            {fila.contraparte}
          </p>
          <p className="text-xs text-neutral-mid">{fila.documentoTipo}</p>
        </div>

        {/* Acciones */}
        <div className="flex shrink-0 items-center gap-2">
          <QavanteButton
            size="sm"
            onClick={onConfirmar}
            disabled={pendiente}
            aria-label={`Confirmar: ${fila.montoTexto} es ${fila.contraparte}`}
          >
            {pendiente ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="h-4 w-4" aria-hidden="true" />
            )}
            Sí, es este
          </QavanteButton>
          <QavanteButton
            size="sm"
            variant="ghost"
            onClick={onRechazar}
            disabled={pendiente}
            aria-label={`Descartar la sugerencia para ${fila.montoTexto}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            No es
          </QavanteButton>
        </div>
      </div>
    </QavanteCard>
  );
}
