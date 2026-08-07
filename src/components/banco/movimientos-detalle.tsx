"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { QavanteCard, QavanteInlineError, QavanteBadge } from "@/components/qavante";
import { formatMoney } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { formatPeriodLabel } from "@/components/gestion/gestion-format";
import { cn } from "@/lib/utils";
import { MesFilter } from "./mes-filter";
import {
  filtrarMovimientos,
  contarMovimientos,
  type MovimientoBanco,
  type MovTab,
  type EstadoConciliacion,
  type SugerenciaConciliacion,
} from "./banco-movimientos-model";

/* Detalle de movimientos de un producto de Banco (cuenta o tarjeta), estilo Chipax: tabs
   Todos / Sugerencias / Abonos / Cargos / Por conciliar + búsqueda + filtro de mes. Presentacional:
   recibe los movimientos del mes; el filtro por tab/texto es local.
   - `conEstado` → columna Estado + tab "Por conciliar" (solo cuentas; la tarjeta no tiene estado).
   - `conciliarEnabled` (flag `bancoConciliacion`) → habilita la conciliación POR movimiento: cada
     "Por conciliar" con sugerencia muestra el match propuesto + "Conciliar" / "Rechazar", y aparece el
     tab "Sugerencias". OFF = Fase 1 read-only. Las mutaciones las corre el contenedor. */

/** Acción individual en curso (deshabilita los botones de esa fila). */
export interface AccionConciliar {
  movId: string;
  tipo: "conciliar" | "rechazar";
}

export interface MovimientosDetalleProps {
  titulo: string;
  subtitulo?: string;
  mesActual: string;
  period: string;
  onPeriodChange: (p: string) => void;
  /** Movimientos del mes (sin filtrar por tab/texto). */
  movimientos: MovimientoBanco[];
  /** Muestra la columna/tab de conciliación (cuentas sí, tarjeta no). */
  conEstado?: boolean;
  loading?: boolean;
  actualizando?: boolean;
  error?: unknown;
  horaTexto?: string | null;
  /** Fase 2: habilita conciliar por movimiento + el tab "Sugerencias" (flag `bancoConciliacion`). */
  conciliarEnabled?: boolean;
  /** `movement_id → sugerencia` de la cola de conciliación. */
  sugerencias?: Map<string, SugerenciaConciliacion>;
  /** Confirma el match sugerido del movimiento. */
  onConciliar?: (movId: string) => void;
  /** Descarta el match sugerido; el movimiento vuelve a 'sin conciliar'. */
  onRechazar?: (movId: string) => void;
  /** Acción individual en curso (spinner + deshabilita esa fila). */
  accionEnCurso?: AccionConciliar | null;
}

export function MovimientosDetalle({
  titulo,
  subtitulo,
  mesActual,
  period,
  onPeriodChange,
  movimientos,
  conEstado = false,
  loading,
  actualizando,
  error,
  horaTexto,
  conciliarEnabled = false,
  sugerencias,
  onConciliar,
  onRechazar,
  accionEnCurso,
}: MovimientosDetalleProps) {
  const [tab, setTab] = React.useState<MovTab>("todos");
  const [texto, setTexto] = React.useState("");

  // El tab "Sugerencias" solo tiene sentido con la conciliación encendida (cuentas).
  const conConciliar = conciliarEnabled && conEstado;
  const idsConSugerencia = React.useMemo(
    () => (conConciliar && sugerencias ? new Set(sugerencias.keys()) : undefined),
    [conConciliar, sugerencias],
  );

  const counts = React.useMemo(
    () => contarMovimientos(movimientos, idsConSugerencia),
    [movimientos, idsConSugerencia],
  );
  const filtered = React.useMemo(
    () => filtrarMovimientos(movimientos, tab, texto, idsConSugerencia),
    [movimientos, tab, texto, idsConSugerencia],
  );

  const tabs: { id: MovTab; label: string; n?: number }[] = [
    { id: "todos", label: "Todos" },
    ...(conConciliar
      ? [{ id: "sugerencias" as MovTab, label: "Sugerencias", n: counts.sugerencias }]
      : []),
    { id: "abonos", label: "Abonos", n: counts.abonos },
    { id: "cargos", label: "Cargos", n: counts.cargos },
    ...(conEstado
      ? [{ id: "por_conciliar" as MovTab, label: "Por conciliar", n: counts.porConciliar }]
      : []),
  ];

  return (
    <div className="space-y-4">
      <Link
        href="/banco"
        className="inline-flex items-center gap-1 text-sm text-neutral-mid transition-colors hover:text-neutral-dark"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver a Banco
      </Link>
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-neutral-mid">{subtitulo}</p>}
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <MesFilter mesActual={mesActual} value={period} onChange={onPeriodChange} />
        {actualizando ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-info-700">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Actualizando…
          </span>
        ) : horaTexto ? (
          <span className="text-xs text-neutral-mid">Actualizado a las {horaTexto}</span>
        ) : null}
      </div>

      {/* Tabs (estilo Chipax) + búsqueda por descripción. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filtrar movimientos">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={cn(
                  "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-brand-primary text-brand-primary"
                    : "border-transparent text-neutral-mid hover:text-neutral-dark",
                )}
              >
                {t.label}
                {t.n != null && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                      active
                        ? "bg-brand-primary-100 text-brand-primary-700"
                        : "bg-neutral-light/60 text-neutral-mid",
                    )}
                  >
                    {t.n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <label className="relative mb-1.5 flex items-center">
          <Search
            className="pointer-events-none absolute left-2.5 h-4 w-4 text-neutral-mid"
            aria-hidden="true"
          />
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por descripción…"
            aria-label="Buscar por descripción"
            className="w-56 rounded-lg border border-border bg-surface py-1.5 pl-8 pr-3 text-sm outline-none focus:border-brand-primary"
          />
        </label>
      </div>

      {error ? (
        <QavanteInlineError error={error} what="los movimientos" />
      ) : loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-neutral-light/30" aria-busy="true" />
      ) : filtered.length === 0 ? (
        <QavanteCard variant="bordered">
          <p className="py-6 text-center text-sm text-neutral-mid">
            {tab === "sugerencias"
              ? "Sin sugerencias de conciliación en este mes."
              : movimientos.length === 0
                ? `Sin movimientos en ${formatPeriodLabel(period)}.`
                : "Ningún movimiento coincide con el filtro."}
          </p>
        </QavanteCard>
      ) : (
        <QavanteCard variant="bordered">
          <ul className="divide-y divide-border">
            {filtered.map((m, i) => {
              const sug =
                conConciliar && m.id != null && m.estado === "por_conciliar"
                  ? sugerencias?.get(m.id)
                  : undefined;
              return (
                <li key={m.id ?? `${m.fecha}-${i}`} className="py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-neutral-dark">{m.glosa}</p>
                      <p className="text-xs text-neutral-mid">
                        {formatDateLike(m.fecha)}
                        {m.cuotas && <> · cuota {m.cuotas}</>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {conEstado && m.estado && <EstadoBadge estado={m.estado} />}
                      <span
                        className={cn(
                          "whitespace-nowrap font-medium tabular-nums",
                          m.monto < 0 ? "text-danger-500" : "text-success-600",
                        )}
                      >
                        {m.monto < 0 ? "−" : "+"}
                        {formatMoney(Math.abs(m.monto), m.moneda)}
                      </span>
                    </div>
                  </div>
                  {sug && (
                    <SugerenciaBanda
                      sug={sug}
                      onConciliar={onConciliar}
                      onRechazar={onRechazar}
                      accionEnCurso={accionEnCurso}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </QavanteCard>
      )}
    </div>
  );
}

function EstadoBadge({ estado }: { estado: EstadoConciliacion }) {
  if (estado === "conciliado") return <QavanteBadge variant="success">Conciliado</QavanteBadge>;
  if (estado === "excluido") return <QavanteBadge variant="default">Excluido</QavanteBadge>;
  return <QavanteBadge variant="warning">Por conciliar</QavanteBadge>;
}

/** Banda con el match propuesto para un movimiento por conciliar + las acciones Conciliar / Rechazar. */
function SugerenciaBanda({
  sug,
  onConciliar,
  onRechazar,
  accionEnCurso,
}: {
  sug: SugerenciaConciliacion;
  onConciliar?: (movId: string) => void;
  onRechazar?: (movId: string) => void;
  accionEnCurso?: AccionConciliar | null;
}) {
  const esCobro = sug.kind === "receivable";
  const enCurso = accionEnCurso?.movId === sug.movementId ? accionEnCurso.tipo : null;
  const bloqueada = enCurso != null;

  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-primary-100 bg-brand-primary-50/60 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        {esCobro ? (
          <ArrowDownLeft className="h-4 w-4 shrink-0 text-success-600" aria-hidden="true" />
        ) : (
          <ArrowUpRight className="h-4 w-4 shrink-0 text-danger-500" aria-hidden="true" />
        )}
        <span className="min-w-0 text-xs text-neutral-dark">
          <span className="text-neutral-mid">{esCobro ? "Cobro a " : "Pago a "}</span>
          <span className="font-medium">{sug.nombre}</span>
          {sug.documentCount > 1 && (
            <span className="text-neutral-mid"> · {sug.documentCount} documentos</span>
          )}
          {sug.score != null && (
            <span className="text-neutral-mid"> · {Math.round(sug.score)}% de certeza</span>
          )}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => onConciliar?.(sug.movementId)}
          disabled={bloqueada}
          className="inline-flex items-center gap-1 rounded-md bg-brand-primary px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-primary-700 disabled:opacity-50"
        >
          {enCurso === "conciliar" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Conciliar
        </button>
        <button
          type="button"
          onClick={() => onRechazar?.(sug.movementId)}
          disabled={bloqueada}
          aria-label="Rechazar sugerencia"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-neutral-mid transition-colors hover:text-neutral-dark disabled:opacity-50"
        >
          {enCurso === "rechazar" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Rechazar
        </button>
      </div>
    </div>
  );
}
