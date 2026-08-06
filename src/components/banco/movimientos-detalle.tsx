"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Search } from "lucide-react";
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
} from "./banco-movimientos-model";

/* Detalle de movimientos de un producto de Banco (cuenta o tarjeta), estilo Chipax (Fase 1, sin
   mutaciones): tabs Todos / Abonos / Cargos / Por conciliar + búsqueda por descripción + el filtro de
   mes. La conciliación POR movimiento (vincular/agregar egreso/…) es Fase 2. Presentacional: recibe los
   movimientos del mes; el filtro por tab/texto es local. `conEstado` → muestra la columna Estado
   Conciliación + el tab "Por conciliar" (solo cuentas; la tarjeta no tiene estado bancario). */

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
}: MovimientosDetalleProps) {
  const [tab, setTab] = React.useState<MovTab>("todos");
  const [texto, setTexto] = React.useState("");

  const counts = React.useMemo(() => contarMovimientos(movimientos), [movimientos]);
  const filtered = React.useMemo(
    () => filtrarMovimientos(movimientos, tab, texto),
    [movimientos, tab, texto],
  );

  const tabs: { id: MovTab; label: string; n?: number }[] = [
    { id: "todos", label: "Todos" },
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
                      active ? "bg-brand-primary-100 text-brand-primary-700" : "bg-neutral-light/60 text-neutral-mid",
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
          <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-neutral-mid" aria-hidden="true" />
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
            {movimientos.length === 0
              ? `Sin movimientos en ${formatPeriodLabel(period)}.`
              : "Ningún movimiento coincide con el filtro."}
          </p>
        </QavanteCard>
      ) : (
        <QavanteCard variant="bordered">
          <ul className="divide-y divide-border">
            {filtered.map((m, i) => (
              <li key={m.id ?? `${m.fecha}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
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
              </li>
            ))}
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
