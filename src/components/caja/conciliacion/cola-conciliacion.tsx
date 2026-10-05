"use client";

import { ArrowRight, Check, Loader2, X } from "lucide-react";
import { QavanteButton, QavanteCard } from "@/components/qavante";
import { cn } from "@/lib/utils";
import { filasParaLote, type FilaCola } from "./reconciliacion-cola-map";

/* Presentacional puro (slots + callbacks, sin fetch): la cola de conciliación. Cada fila enfrenta
   un movimiento del banco con el documento que el motor cree que le corresponde (score 60-90). El
   dueño confirma o descarta. La orquestación (fetch + mutaciones) vive en `cola-conciliacion-live`.
   Testeable por Storybook `play` (ADR-0018): recibe datos, no llama al backend. */

export type ColaConciliacionProps = {
  filas: FilaCola[];
  onConfirmar: (id: string) => void;
  onRechazar: (id: string) => void;
  /** Abre candidatos documentales; la elección siempre la confirma una persona. */
  onElegirDocumento?: (id: string) => void;
  onConciliarTodas: () => void;
  /** Ids con una mutación en curso → deshabilitan sus botones y muestran spinner. */
  pendientes: ReadonlySet<string>;
  conciliandoTodas: boolean;
};

export function ColaConciliacion({
  filas,
  onConfirmar,
  onRechazar,
  onElegirDocumento,
  onConciliarTodas,
  pendientes,
  conciliandoTodas,
}: ColaConciliacionProps) {
  const total = filas.length;
  /* EL CONTEO DEL BOTÓN ES DE LO QUE EL LOTE PUEDE APLICAR, NO DE LAS FILAS.
     Antes decía "Conciliar todas (N)" con N = filas y mandaba las N; el backend rechazaba las
     que no podía aplicar. Un botón que promete N y aplica menos es la misma mentira con otro
     número, y en un lote es peor: falla en el medio y nadie sabe cuáles quedaron. */
  const enLote = filasParaLote(filas).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-mid">
          {total === 1
            ? "Hay 1 conciliación propuesta por confirmar."
            : `Hay ${total} conciliaciones propuestas por confirmar.`}
          {/* Nunca el conteo del lote solo: si no coincide con las propuestas, se dice cuántas
              quedan afuera y que cada una trae su motivo, en vez de dejar la diferencia muda. */}
          {enLote < total &&
            (enLote === 0
              ? " Ninguna se puede aplicar en lote; cada una dice por qué."
              : ` ${enLote} se pueden aplicar en lote: las otras ${total - enLote} dicen por qué no.`)}
        </p>
        <QavanteButton
          size="sm"
          onClick={onConciliarTodas}
          loading={conciliandoTodas}
          disabled={enLote === 0}
        >
          Conciliar todas ({enLote})
        </QavanteButton>
      </div>

      <ul className="space-y-3">
        {filas.map((fila) => (
          <li key={fila.id}>
            <FilaConciliacion
              fila={fila}
              onConfirmar={() => onConfirmar(fila.id)}
              onRechazar={() => onRechazar(fila.id)}
              onElegirDocumento={onElegirDocumento ? () => onElegirDocumento(fila.id) : undefined}
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
  onElegirDocumento,
  pendiente,
}: {
  fila: FilaCola;
  onConfirmar: () => void;
  onRechazar: () => void;
  onElegirDocumento?: () => void;
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
          {/* EL BOTÓN SÓLO SI EL SERVIDOR LO PERMITE.
              Acá "Sí, es este" se ofrecía en TODAS las filas, deshabilitado nada más que
              mientras había una acción en vuelo. Con `can_confirm: false` el backend responde
              409 siempre, así que el botón no podía funcionar: ahora en su lugar va el motivo
              que manda el servidor, con el monto del problema adentro. La propuesta se sigue
              mostrando —saber que hay un documento que casi calza es información útil— y
              "Elegir otro" sigue siendo el camino que sí existe. */}
          {fila.puedeConfirmar ? (
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
          ) : (
            <p className="max-w-[16rem] text-xs text-neutral-mid">
              {fila.bloqueo
                ? `${fila.bloqueo.mensaje} ${
                    fila.bloqueo.reintentable
                      ? "Actualiza la cola y vuelve a intentar."
                      : "Elige otro documento o descártala."
                  }`
                : "Esta propuesta no se puede confirmar como está; elige otro documento o descártala."}
            </p>
          )}
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
          {onElegirDocumento && (
            <QavanteButton
              size="sm"
              variant="secondary"
              onClick={onElegirDocumento}
              disabled={pendiente}
              aria-label={`Elegir otro documento para ${fila.montoTexto}`}
            >
              Elegir otro
            </QavanteButton>
          )}
        </div>
      </div>
    </QavanteCard>
  );
}
