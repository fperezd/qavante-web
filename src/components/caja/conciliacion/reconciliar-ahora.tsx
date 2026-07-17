"use client";

import { RefreshCw } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import type { ResumenReconcile } from "./reconciliacion-cola-map";

/* Presentacional puro (botón + resumen, sin fetch): corre el motor de conciliación a demanda. El
   motor auto-aplica los matches de alta confianza y deja los de confianza media en la cola de abajo.
   La orquestación vive en `cola-conciliacion-live`. Testeable por Storybook `play` (ADR-0018). */

export type ReconciliarAhoraProps = {
  onReconciliar: () => void;
  corriendo: boolean;
  /** Resultado de la última corrida (persiste hasta la próxima); null si no corrió aún. */
  ultimoResumen: ResumenReconcile | null;
};

export function ReconciliarAhora({ onReconciliar, corriendo, ultimoResumen }: ReconciliarAhoraProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-neutral-light/20 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-dark">
          Buscar movimientos para conciliar
        </p>
        <p className="text-xs text-neutral-mid">
          {ultimoResumen
            ? ultimoResumen.mensaje
            : "Qavante cruza tus movimientos del banco contra tus documentos y deja acá los que no puede dar por seguros."}
        </p>
      </div>
      <QavanteButton size="sm" variant="secondary" onClick={onReconciliar} loading={corriendo}>
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Conciliar ahora
      </QavanteButton>
    </div>
  );
}
