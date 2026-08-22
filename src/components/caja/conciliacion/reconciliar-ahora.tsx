"use client";

import { RefreshCw, RotateCcw } from "lucide-react";
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
  /** Re-analiza todo: descarta las sugerencias pendientes y rehace la cola con el scorer y los
   *  aliases actuales. Opcional — sin esta prop la acción no se muestra. */
  onReanalizar?: () => void;
  reanalizando?: boolean;
};

export function ReconciliarAhora({
  onReconciliar,
  corriendo,
  ultimoResumen,
  onReanalizar,
  reanalizando = false,
}: ReconciliarAhoraProps) {
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
      <div className="flex items-center gap-2">
        {onReanalizar ? (
          <QavanteButton
            size="sm"
            variant="ghost"
            onClick={onReanalizar}
            loading={reanalizando}
            disabled={corriendo}
            title="Descarta las sugerencias pendientes y rehace la cola. Lo ya conciliado no se toca."
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Rehacer la cola
          </QavanteButton>
        ) : null}
        <QavanteButton
          size="sm"
          variant="secondary"
          onClick={onReconciliar}
          loading={corriendo}
          disabled={reanalizando}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Conciliar ahora
        </QavanteButton>
      </div>
    </div>
  );
}
