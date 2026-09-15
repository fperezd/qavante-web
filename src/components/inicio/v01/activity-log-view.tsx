"use client";

import * as React from "react";
import Link from "next/link";
import { CircleDot } from "lucide-react";
import type { RevertActionResponse } from "@/lib/api/reversible-actions";
import { formatDateTimeLike } from "@/lib/formatters/date";
import type { ActividadAutomatica } from "./activity-log-model";

export interface ActivityLogViewProps {
  activities: readonly ActividadAutomatica[] | null;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onUndo?: (actionId: string) => Promise<RevertActionResponse>;
  /** La portada enlaza cada acción a la bitácora completa; la ruta completa no se enlaza a sí misma. */
  detailLinks?: boolean;
  idPrefix?: string;
}

export function mensajeDeshacer(result: RevertActionResponse): string {
  if (result.result === "reverted") return "Acción deshecha.";
  if (result.result === "already_reverted") return "Esta acción ya estaba deshecha.";
  if (result.result === "undo_expired") return "El plazo para deshacer esta acción venció.";
  if (result.result === "undo_not_supported") {
    /* `motivo` es un código enumerado por el productor (`estado_derivado` / `estado_bloqueado`),
       no prosa libre: se traduce a copy fijo, nunca se refleja el texto recibido. */
    if (result.detail?.motivo === "estado_derivado") {
      return "Algo cambió después de esta acción. No se tocó nada.";
    }
    if (result.detail?.motivo === "estado_bloqueado") {
      return "Otra operación está usando este movimiento. No se tocó nada; vuelve a intentarlo.";
    }
    return "No pudimos confirmar que esta acción aún se pueda deshacer.";
  }
  return "No pudimos confirmar el resultado de Deshacer.";
}

/** Presenta el subconjunto disponible de Ley 5: automatismos reversibles, no actividad integral. */
export function ActivityLogView({
  activities,
  loading = false,
  error = false,
  onRetry,
  onUndo,
  detailLinks = false,
  idPrefix = "actividad",
}: ActivityLogViewProps) {
  const [pending, setPending] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  async function deshacer(actionId: string) {
    if (!onUndo) return;
    setPending(actionId);
    setNotice(null);
    try {
      setNotice(mensajeDeshacer(await onUndo(actionId)));
    } catch {
      setNotice("No pudimos enviar Deshacer. No confirmamos cambios; vuelve a intentarlo.");
    } finally {
      setPending(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-neutral-mid">Estamos buscando lo que Qavante hizo solo.</p>;
  }
  if (error) {
    return (
      <div className="space-y-2 text-sm text-neutral-mid" role="status">
        <p>No pudimos traer la bitácora de acciones automáticas. No sabemos qué hizo Qavante.</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className={LINK_BUTTON}>
            Reintentar
          </button>
        )}
      </div>
    );
  }
  if (!activities || activities.length === 0) {
    return (
      <p className="text-sm text-neutral-mid">
        Aún no hay automatismos reversibles registrados dentro de su ventana de Deshacer.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border">
      {activities.map((activity) => (
        <div
          key={activity.actionId}
          id={`${idPrefix}-${activity.actionId}`}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm text-neutral-mid"
        >
          <CircleDot className="h-4 w-4 shrink-0 text-neutral-mid" aria-hidden="true" />
          <p className="min-w-0 flex-1">
            <strong className="text-neutral-dark">{activity.resumen}</strong>
            <span className="ml-1 text-xs">
              · Registrado el {formatDateTimeLike(activity.creadaEn)}
            </span>
            {activity.deshacerDisponible && (
              <span className="ml-1 text-xs">
                · Deshacer disponible hasta {formatDateTimeLike(activity.venceEn)}
              </span>
            )}
          </p>
          {activity.deshacerDisponible && onUndo && (
            <button
              type="button"
              aria-label={`Deshacer: ${activity.resumen}`}
              onClick={() => void deshacer(activity.actionId)}
              disabled={pending === activity.actionId}
              className={LINK_BUTTON}
            >
              {pending === activity.actionId ? "Deshaciendo…" : "Deshacer"}
            </button>
          )}
          {!activity.deshacerDisponible && (
            <span className="shrink-0 text-xs text-neutral-mid">Deshacer no disponible</span>
          )}
          {detailLinks && (
            <Link href={`/inicio/actividad#actividad-${activity.actionId}`} className={LINK_BUTTON}>
              Ver acción
            </Link>
          )}
        </div>
      ))}
      {notice && (
        <p className="pt-3 text-sm text-neutral-mid" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}

const LINK_BUTTON =
  "shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-brand-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:opacity-50";
