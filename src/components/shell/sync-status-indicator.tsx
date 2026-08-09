"use client";

import * as React from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { QavanteBadge } from "@/components/qavante";
import {
  useSourcesStatus,
  aggregateSyncStatus,
  isSourceCaida,
  visibleSources,
  type SourceStatus,
} from "@/lib/api/sources-status";
import { useDismiss } from "@/lib/hooks/use-dismiss";

/* Indicador de sincronización (header, arriba a la derecha). Muestra el estado
   agregado de las fuentes (SII, banco, TGR, etc.) + la última actualización, y
   despliega el detalle por fuente. Gated por `syncStatus` (lo monta el header
   solo si el flag está ON). FE-first contra `/api/sources/status` (hoy
   api-key-only → ver sources-status.ts). */

const DOT: Record<string, string> = {
  ok: "bg-success-500",
  warning: "bg-warning-500",
  caido: "bg-warning-600",
  error: "bg-danger-500",
};
const LABEL: Record<string, string> = {
  ok: "Actualizado",
  warning: "Desactualizado",
  caido: "Con fuentes caídas",
  error: "Con errores",
};

/** ISO UTC → "DD-MM-AAAA HH:MM:SS" (convención Qavante: día-mes-año). */
function formatDateTime(iso: string | null): string {
  if (!iso) return "s/d";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const STATE_BADGE: Record<
  string,
  { variant: "success" | "warning" | "danger" | "default"; label: string }
> = {
  ok: { variant: "success", label: "OK" },
  syncing: { variant: "default", label: "Sincronizando" },
  stale: { variant: "warning", label: "Desactualizado" },
  missing: { variant: "warning", label: "Sin conectar" },
  // "unavailable" que llega a la fila es un caído real (se filtran los fantasmas de Fase 2 sin
  // last_sync). Ámbar, no rojo: es transitorio (reconectar), distinto de un "error" de datos.
  unavailable: { variant: "warning", label: "Caída" },
  error: { variant: "danger", label: "Error" },
};

export function SyncStatusIndicator() {
  const query = useSourcesStatus();
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close, triggerRef);

  // Mientras carga o si falla, no mostramos un estado engañoso: ocultamos hasta
  // tener data (el header sigue limpio).
  if (!query.data) return null;

  // Fuentes ocultas (TGR por ahora, ver `FUENTES_OCULTAS_SYNC`): se filtran del agregado Y del detalle.
  const sources = visibleSources(query.data.sources ?? []);
  const agg = aggregateSyncStatus(sources);
  /* El dropdown muestra solo lo CONECTADO (lo que realmente alimenta datos), ordenado por severidad:
     error → caída (unavailable con last_sync, ej. banco caído) → desactualizado → sincronizando → ok.
     Las "unavailable" fantasma de Fase 2 (SIN last_sync) se ocultan y las "missing" (sin conectar) se
     resumen al pie → el problema real (banco caído / error) deja de estar enterrado entre fuentes
     fantasma (auditoría UX F-03/F-07), pero un caído REAL ahora SÍ aparece (antes desaparecía). */
  const SEV: Record<string, number> = { error: 0, unavailable: 1, stale: 2, syncing: 3, ok: 4 };
  const connected = sources
    .filter(
      (s) =>
        s.state === "error" ||
        s.state === "stale" ||
        s.state === "ok" ||
        s.state === "syncing" ||
        isSourceCaida(s),
    )
    .sort((a, b) => (SEV[a.state] ?? 5) - (SEV[b.state] ?? 5));
  const sinConectar = sources.filter((s) => s.state === "missing").length;

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-neutral-mid hover:bg-brand-primary-50"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Sincronización: ${LABEL[agg.level]}. Última: ${formatDateTime(agg.lastSync)}.`}
      >
        <span className={`h-2 w-2 rounded-full ${DOT[agg.level]}`} aria-hidden="true" />
        <span className="text-neutral-dark">{LABEL[agg.level]}</span>
        {agg.level === "ok" && agg.lastSync && (
          <span className="hidden lg:inline tabular-nums">· {formatDateTime(agg.lastSync)}</span>
        )}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="group"
          aria-label="Estado de sincronización por fuente"
          className="absolute right-0 z-30 mt-1 w-80 rounded-xl border border-border bg-surface p-2 shadow-lg"
        >
          <div className="flex items-center justify-between px-1 pb-2 text-xs text-neutral-mid">
            <span className="font-medium text-neutral-dark">Sincronización</span>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="inline-flex items-center gap-1 hover:text-brand-primary"
            >
              <RefreshCw
                className={`h-3 w-3 ${query.isFetching ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              Actualizar
            </button>
          </div>

          {connected.length === 0 ? (
            <p className="px-1 py-2 text-sm text-neutral-mid">No hay fuentes conectadas todavía.</p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {connected.map((s) => (
                <SourceRow key={s.source} source={s} />
              ))}
            </ul>
          )}
          {sinConectar > 0 && (
            <p className="border-t border-border/60 px-1 pt-2 text-xs text-neutral-mid">
              {sinConectar} {sinConectar === 1 ? "fuente sin conectar" : "fuentes sin conectar"}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SourceRow({ source: s }: { source: SourceStatus }) {
  const badge = STATE_BADGE[s.state] ?? { variant: "default" as const, label: s.state };
  return (
    <li className="flex items-start justify-between gap-2 rounded-lg px-1 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-dark">
          {s.display_name || s.source}
        </p>
        {s.last_sync ? (
          <p className="text-xs text-neutral-mid tabular-nums">{formatDateTime(s.last_sync)}</p>
        ) : (
          <p className="text-xs text-neutral-mid">Sin sincronizar</p>
        )}
        {s.reason && s.state !== "ok" && (
          <p className="mt-0.5 text-xs text-neutral-mid">{s.reason}</p>
        )}
      </div>
      <QavanteBadge variant={badge.variant}>{badge.label}</QavanteBadge>
    </li>
  );
}
