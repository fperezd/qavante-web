"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCheck,
  FileText,
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
  type EstadoClasificacion,
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
  /** Confirma en lote sólo las propuestas que el backend marcó como aptas. */
  onConciliarLote?: (movementIds: string[]) => void;
  loteEnCurso?: boolean;
  /** Acción individual en curso (spinner + deshabilita esa fila). */
  accionEnCurso?: AccionConciliar | null;
  /** Abre el detalle canónico del movimiento. Abrir es siempre read-only. */
  onOpenMovement?: (movement: MovimientoBanco) => void;
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
  onConciliarLote,
  loteEnCurso = false,
  accionEnCurso,
  onOpenMovement,
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
    ...(conEstado
      ? [{ id: "por_clasificar" as MovTab, label: "Sin clasificar", n: counts.porClasificar }]
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
      ) : tab === "sugerencias" ? (
        <MesaSugerencias
          movimientos={filtered}
          sugerencias={sugerencias}
          subtitulo={subtitulo}
          onOpenMovement={onOpenMovement}
          onConciliar={onConciliar}
          onRechazar={onRechazar}
          onConciliarLote={onConciliarLote}
          accionEnCurso={accionEnCurso}
          loteEnCurso={loteEnCurso}
        />
      ) : (
        <QavanteCard variant="bordered">
          <ul className="divide-y divide-border">
            {filtered.map((m, i) => {
              const sug =
                conConciliar && m.id != null && m.estado === "por_conciliar"
                  ? sugerencias?.get(m.id)
                  : undefined;
              const contenido = (
                <>
                  <div className="min-w-0 text-left">
                    <p className="truncate text-sm text-neutral-dark">{m.glosa}</p>
                    <p className="text-xs text-neutral-mid">
                      {formatDateLike(m.fecha)}
                      {m.cuotas && <> · cuota {m.cuotas}</>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {conEstado && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {m.estado && <EstadoBadge estado={m.estado} />}
                        {m.estadoClasificacion && (
                          <ClasificacionBadge estado={m.estadoClasificacion} />
                        )}
                      </div>
                    )}
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
                </>
              );
              return (
                <li key={m.id ?? `${m.fecha}-${i}`} className="py-2.5">
                  {m.id && onOpenMovement ? (
                    <button
                      type="button"
                      onClick={() => onOpenMovement(m)}
                      aria-label={`Abrir detalle de ${m.glosa}`}
                      className="-my-2.5 flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-brand-primary-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                    >
                      {contenido}
                    </button>
                  ) : (
                    <div className="flex items-center justify-between gap-3">{contenido}</div>
                  )}
                  {sug && (
                    <SugerenciaBanda
                      sug={sug}
                      onReview={m.id && onOpenMovement ? () => onOpenMovement(m) : undefined}
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

export function MesaSugerencias({
  movimientos,
  sugerencias,
  subtitulo,
  onOpenMovement,
  onConciliar,
  onRechazar,
  onConciliarLote,
  accionEnCurso,
  loteEnCurso,
}: {
  movimientos: MovimientoBanco[];
  sugerencias?: Map<string, SugerenciaConciliacion>;
  subtitulo?: string;
  onOpenMovement?: (movement: MovimientoBanco) => void;
  onConciliar?: (movementId: string) => void;
  onRechazar?: (movementId: string) => void;
  onConciliarLote?: (movementIds: string[]) => void;
  accionEnCurso?: AccionConciliar | null;
  loteEnCurso: boolean;
}) {
  const propuestas = movimientos.flatMap((movement) => {
    const suggestion = movement.id ? sugerencias?.get(movement.id) : undefined;
    return suggestion ? [{ movement, suggestion }] : [];
  });
  const idsLote = propuestas
    .filter(({ suggestion }) => suggestion.bulkEligible)
    .map(({ suggestion }) => suggestion.movementId);

  return (
    <section aria-label="Sugerencias de conciliación" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-dark">Sugerencias de conciliación</h2>
          <p className="text-xs text-neutral-mid">
            Compara el movimiento con sus respaldos. Qavante vuelve a validar todo al confirmar.
          </p>
        </div>
        {idsLote.length > 0 && (
          <button
            type="button"
            onClick={() => onConciliarLote?.(idsLote)}
            disabled={!onConciliarLote || loteEnCurso || accionEnCurso != null}
            className="inline-flex items-center gap-2 rounded-lg bg-success-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-success-700 disabled:opacity-50"
          >
            {loteEnCurso ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
            )}
            Conciliar todas ({idsLote.length})
          </button>
        )}
      </div>

      <div className="hidden grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)_9rem] gap-3 px-4 text-xs font-semibold uppercase tracking-wide text-neutral-mid lg:grid">
        <span>Movimiento bancario</span>
        <span aria-hidden="true" />
        <span>Documentos de respaldo</span>
        <span>Acción</span>
      </div>

      {propuestas.map(({ movement, suggestion }) => {
        const enCurso = accionEnCurso?.movId === suggestion.movementId;
        const snapshot = suggestion.movimiento;
        const accionesHabilitadas = snapshot.completo;
        return (
          <article
            key={suggestion.movementId}
            className="grid gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)_9rem] lg:items-stretch"
          >
            <div className="min-w-0 rounded-lg p-2 text-left">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-neutral-mid">
                  {snapshot.fecha ? formatDateLike(snapshot.fecha) : "Fecha no informada"}
                  {subtitulo ? ` · ${subtitulo}` : ""}
                </span>
                <QavanteBadge
                  variant={snapshot.direccion === "credit" ? "success" : "danger"}
                >
                  {snapshot.direccion === "credit"
                    ? "Abono"
                    : snapshot.direccion === "debit"
                      ? "Cargo"
                      : "Dirección no informada"}
                </QavanteBadge>
              </div>
              <p className="line-clamp-2 text-sm font-medium text-neutral-dark">
                {snapshot.glosa ?? "Descripción no informada"}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-neutral-mid">
                <span>Saldo por asignar</span>
                <strong className="text-base tabular-nums text-neutral-dark">
                  {snapshot.monto != null && snapshot.moneda
                    ? formatMoney(Math.abs(snapshot.monto), snapshot.moneda)
                    : "Monto o moneda no informados"}
                </strong>
              </div>
              {!snapshot.completo && (
                <p className="mt-2 text-sm text-warning-700">
                  Datos del movimiento incompletos; no se puede actuar sobre esta propuesta.
                </p>
              )}
            </div>

            <div className="flex items-center justify-center text-neutral-mid" aria-hidden="true">
              <span className="rounded-full border border-border bg-neutral-light/30 px-2 py-1 text-xs">
                ↔
              </span>
            </div>

            <div className="min-w-0 rounded-lg border border-brand-primary-100 bg-brand-primary-50/40 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-brand-primary-700">
                  {suggestion.topology != null && suggestion.documentCount != null
                    ? `${suggestion.topology} · ${
                        suggestion.documentCount === 1
                          ? "1 respaldo"
                          : `${suggestion.documentCount} respaldos`
                      }`
                    : "Información del respaldo incompleta"}
                </span>
                {suggestion.score != null && (
                  <span className="text-xs text-neutral-mid">Confianza {suggestion.score}%</span>
                )}
              </div>
              <div className="space-y-2">
                {suggestion.documents.map((doc) => (
                  <div
                    key={doc.documentId}
                    className="flex items-start justify-between gap-3 border-t border-brand-primary-100 pt-2 first:border-0 first:pt-0"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium text-neutral-dark">
                        <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {doc.nombre ?? "Respaldo sin nombre"}
                      </p>
                      <p className="text-xs text-neutral-mid">
                        {labelDocumento(doc.documentType, doc.sourceProvider)}
                        {doc.folio ? ` · Folio ${doc.folio}` : ""}
                        {doc.rut ? ` · RUT ${doc.rut}` : ""}
                      </p>
                      {doc.fecha && (
                        <p className="text-xs text-neutral-mid">
                          Emitido {formatDateLike(doc.fecha)}
                        </p>
                      )}
                    </div>
                    <strong className="shrink-0 text-sm tabular-nums text-neutral-dark">
                      {snapshot.moneda ? formatMoney(doc.monto, snapshot.moneda) : "Moneda no informada"}
                    </strong>
                  </div>
                ))}
                {suggestion.documents.length === 0 && (
                  <p className="text-sm text-warning-700">
                    El respaldo cambió o ya no está disponible.
                  </p>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Evidencia de la sugerencia">
                {suggestion.reasons.map((reason) => (
                  <span
                    key={reason}
                    className="rounded-full bg-surface px-2 py-1 text-[11px] text-neutral-mid ring-1 ring-border"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-row gap-2 lg:flex-col lg:justify-center">
              {!accionesHabilitadas ? (
                <span className="inline-flex flex-1 items-center justify-center rounded-lg border border-border px-3 py-2 text-sm text-neutral-mid lg:flex-none">
                  Acción no disponible
                </span>
              ) : suggestion.canConfirm ? (
                <button
                  type="button"
                  onClick={() => onConciliar?.(suggestion.movementId)}
                  disabled={!onConciliar || enCurso || loteEnCurso}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-white hover:bg-brand-primary-700 disabled:opacity-50 lg:flex-none"
                >
                  {enCurso && accionEnCurso?.tipo === "conciliar" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  )}
                  Conciliar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenMovement?.(movement)}
                  className="inline-flex flex-1 items-center justify-center rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-white lg:flex-none"
                >
                  Revisar
                </button>
              )}
              {accionesHabilitadas && (
                <button
                  type="button"
                  onClick={() => onRechazar?.(suggestion.movementId)}
                  disabled={!onRechazar || enCurso || loteEnCurso}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-3 py-2 text-sm text-neutral-mid hover:text-neutral-dark disabled:opacity-50 lg:flex-none"
                >
                  {enCurso && accionEnCurso?.tipo === "rechazar" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <X className="h-4 w-4" aria-hidden="true" />
                  )}
                  Rechazar
                </button>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function labelDocumento(documentType: number | null, sourceProvider: string | null): string {
  if (documentType === 33) return "Factura electrónica";
  if (documentType === 34) return "Factura exenta";
  if (documentType === 61) return "Nota de crédito";
  if (sourceProvider === "sii_bhe_received") return "Boleta de honorarios";
  if (sourceProvider === "buk") return "Remuneración";
  if (sourceProvider === "previred") return "Previred";
  if (sourceProvider === "tgr") return "Impuesto / TGR";
  return "Documento de respaldo";
}

function EstadoBadge({ estado }: { estado: EstadoConciliacion }) {
  if (estado === "conciliado") return <QavanteBadge variant="success">Conciliado</QavanteBadge>;
  if (estado === "parcial")
    return <QavanteBadge variant="warning">Conciliado parcial</QavanteBadge>;
  if (estado === "excluido") return <QavanteBadge variant="default">Excluido</QavanteBadge>;
  if (estado === "no_requerido") return <QavanteBadge variant="default">No requiere</QavanteBadge>;
  return <QavanteBadge variant="warning">Por conciliar</QavanteBadge>;
}

function ClasificacionBadge({ estado }: { estado: EstadoClasificacion }) {
  if (estado === "clasificado") {
    return <QavanteBadge variant="success">Clasificado</QavanteBadge>;
  }
  if (estado === "revision")
    return <QavanteBadge variant="warning">Revisar clasificación</QavanteBadge>;
  return <QavanteBadge variant="default">Sin clasificar</QavanteBadge>;
}

/** Banda con el match propuesto para un movimiento por conciliar + las acciones Conciliar / Rechazar. */
function SugerenciaBanda({
  sug,
  onReview,
  onConciliar,
  onRechazar,
  accionEnCurso,
}: {
  sug: SugerenciaConciliacion;
  onReview?: () => void;
  onConciliar?: (movId: string) => void;
  onRechazar?: (movId: string) => void;
  accionEnCurso?: AccionConciliar | null;
}) {
  const esCobro = sug.kind === "receivable";
  const contraparteIdentificada = Boolean(sug.nombre);
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
          <span className="text-neutral-mid">
            {contraparteIdentificada
              ? esCobro
                ? "Posible cobro de "
                : "Posible pago a "
              : "Propuesta incompleta: falta identificar la contraparte"}
          </span>
          {sug.nombre && <span className="font-medium">{sug.nombre}</span>}
            {sug.documentCount != null && sug.documentCount > 1 && (
            <span className="text-neutral-mid"> · {sug.documentCount} documentos</span>
          )}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {contraparteIdentificada ? (
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
        ) : (
          <button
            type="button"
            onClick={onReview}
            disabled={!onReview || bloqueada}
            className="inline-flex items-center rounded-md bg-brand-primary px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-primary-700 disabled:opacity-50"
          >
            Revisar
          </button>
        )}
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
