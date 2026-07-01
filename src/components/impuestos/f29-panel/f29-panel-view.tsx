"use client";

import * as React from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Download,
  Info,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { QavanteBadge, QavanteCard } from "@/components/qavante";
import { siiF29PdfUrl } from "@/lib/api/sii";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { cn } from "@/lib/utils";
import { f29Status, TONE_BADGE, TONE_DOT } from "./f29-status";
import type { F29AnnualResponse, F29Declaracion, F29Resumen, F29TendenciaPunto } from "./types";

/* Panel anual de F29 — vista de control de gestión (prototipo).
 *
 * Presentacional puro: recibe `data` por prop (Storybook-friendly, no requiere
 * mock de hooks). Cuando exista `GET /api/sii/f29?anio=YYYY` (qavante-api#408)
 * un wrapper client lo alimenta con el hook real.
 *
 * §17.4: el FE no calcula finanzas — todos los agregados (YTD, remanente,
 * cuadratura, tendencia) los provee el backend. Acá solo se presentan y se
 * deriva el semáforo (presentación) de campos ya entregados. */

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function mesIndex(periodo: string): number {
  const m = /^\d{4}-(\d{2})$/.exec(periodo);
  return m ? Number(m[1]) - 1 : 0;
}
function mesLabel(periodo: string): string {
  return MESES[mesIndex(periodo)] ?? periodo;
}
function mesAbbr(periodo: string): string {
  return mesLabel(periodo).slice(0, 3);
}
function money(v: number | null | undefined): string {
  return v == null ? "—" : formatClp(v);
}
function daysUntil(fecha: string, now: Date): number {
  const hoy = Date.parse(now.toISOString().slice(0, 10));
  const target = Date.parse(fecha);
  return Math.round((target - hoy) / 86_400_000);
}

export interface F29PanelViewProps {
  data: F29AnnualResponse;
  /** Años disponibles para el selector (incluye el actual). */
  anios?: number[];
  onAnioChange?: (anio: number) => void;
}

export function F29PanelView({ data, anios, onAnioChange }: F29PanelViewProps) {
  const now = React.useMemo(() => new Date(), []);
  const [selected, setSelected] = React.useState<string | null>(null);
  const selectedDecl = data.declaraciones.find((d) => d.periodo === selected) ?? null;

  return (
    <div className="space-y-5">
      <PanelHeader anio={data.anio} anios={anios} onAnioChange={onAnioChange} />
      <VencimientoBanner resumen={data.resumen} declaraciones={data.declaraciones} now={now} />
      <KpiRow resumen={data.resumen} />
      <TrendCard puntos={data.tendencia} />
      <DeclaracionesCard
        declaraciones={data.declaraciones}
        resumen={data.resumen}
        now={now}
        selected={selected}
        onSelect={(periodo) => setSelected((prev) => (prev === periodo ? null : periodo))}
      />
      {selectedDecl && <DetailCard declaracion={selectedDecl} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* ── Header + selector de año ─────────────────────────────────────────── */

function PanelHeader({
  anio,
  anios,
  onAnioChange,
}: {
  anio: number;
  anios?: number[];
  onAnioChange?: (anio: number) => void;
}) {
  const options = anios && anios.length > 0 ? anios : [anio];
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-neutral-dark">F29 — Impuestos mensuales</h1>
        <p className="text-sm text-neutral-mid">
          Estado de tu IVA y PPM mes a mes. Verde al día, amarillo con observaciones, rojo
          vencido impago.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm text-neutral-mid">
        Año
        <select
          value={anio}
          onChange={(e) => onAnioChange?.(Number(e.target.value))}
          className="h-9 rounded-md border border-border bg-surface px-3 text-sm font-medium text-neutral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          {options.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/* ── Banner de próximo vencimiento / vencidos ─────────────────────────── */

function VencimientoBanner({
  resumen,
  declaraciones,
  now,
}: {
  resumen: F29Resumen;
  declaraciones: F29Declaracion[];
  now: Date;
}) {
  const vencidos = declaraciones.filter((d) => f29Status(d, now).tone === "danger");
  const primerVencido = vencidos[0];

  if (primerVencido) {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl border border-danger-500/40 bg-danger-500/5 p-4 text-sm"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-500" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-medium text-neutral-dark">
            {vencidos.length === 1
              ? `Tienes 1 F29 vencido impago (${mesLabel(primerVencido.periodo)}).`
              : `Tienes ${vencidos.length} F29 vencidos impagos.`}
          </p>
          <p className="text-neutral-mid">
            Regulariza cuanto antes para evitar intereses y multas del SII.
          </p>
        </div>
      </div>
    );
  }

  const prox = resumen.proximo_vencimiento;
  if (!prox) return null;
  const dias = daysUntil(prox.fecha, now);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-info-500/30 bg-info-500/5 p-4 text-sm">
      <CalendarClock className="h-5 w-5 flex-shrink-0 text-info-500" aria-hidden="true" />
      <p className="flex-1 text-neutral-dark">
        Tu próximo F29 ({mesLabel(prox.periodo)}) vence{" "}
        <span className="font-medium">
          {dias <= 0 ? "hoy" : `en ${dias} ${dias === 1 ? "día" : "días"}`}
        </span>{" "}
        ({formatDateLike(prox.fecha)})
        {prox.monto_estimado != null && (
          <>
            {" · "}estimado <span className="font-medium">{formatClp(prox.monto_estimado)}</span>
          </>
        )}
        .
      </p>
      <a
        href="/caja/proyeccion"
        className="whitespace-nowrap text-sm font-medium text-brand-primary hover:underline"
      >
        Ver en Caja →
      </a>
    </div>
  );
}

/* ── Tarjetas KPI ─────────────────────────────────────────────────────── */

function KpiRow({ resumen }: { resumen: F29Resumen }) {
  const varPct = pctVariacion(resumen.iva_neto_pagado_ytd, resumen.iva_neto_pagado_ytd_prev);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="IVA neto pagado"
        value={money(resumen.iva_neto_pagado_ytd)}
        sub={
          varPct ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium",
                varPct.up ? "text-danger-500" : "text-success-500",
              )}
            >
              {varPct.up ? (
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {varPct.text} vs año anterior
            </span>
          ) : (
            <span className="text-neutral-mid">En el año</span>
          )
        }
      />
      <KpiCard
        label="PPM acumulado"
        value={money(resumen.ppm_acumulado_ytd)}
        sub={<span className="text-neutral-mid">Crédito para tu Renta (F22)</span>}
      />
      <KpiCard
        label="Remanente crédito fiscal"
        value={money(resumen.remanente_credito_fiscal)}
        sub={<RemanenteHint tendencia={resumen.remanente_tendencia} />}
      />
      <PostergacionCard resumen={resumen} />
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: React.ReactNode }) {
  return (
    <QavanteCard variant="bordered">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
          {label}
        </p>
        <p className="text-2xl font-semibold tabular-nums text-neutral-dark">{value}</p>
        <p className="text-xs">{sub}</p>
      </div>
    </QavanteCard>
  );
}

function RemanenteHint({ tendencia }: { tendencia: F29Resumen["remanente_tendencia"] }) {
  if (tendencia === "subiendo") {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-warning-500">
        <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
        Subiendo — caja inmovilizada
      </span>
    );
  }
  if (tendencia === "bajando") {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-success-500">
        <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
        Bajando
      </span>
    );
  }
  return <span className="text-neutral-mid">Crédito acumulado a tu favor</span>;
}

function PostergacionCard({ resumen }: { resumen: F29Resumen }) {
  const [open, setOpen] = React.useState(false);
  const tramos = resumen.iva_postergado_tramos;
  const pendiente = resumen.iva_postergado_pendiente;

  return (
    <QavanteCard variant="bordered">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
          IVA postergado pendiente
        </p>
        <p className="text-2xl font-semibold tabular-nums text-neutral-dark">{money(pendiente)}</p>
        {tramos.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            {tramos.length} {tramos.length === 1 ? "tramo" : "tramos"} — ver vencimientos
          </button>
        ) : (
          <p className="text-xs text-neutral-mid">Sin IVA diferido</p>
        )}
        {open && tramos.length > 0 && (
          <ul className="mt-1 space-y-1 border-t border-border/60 pt-2 text-xs">
            {tramos.map((t) => (
              <li key={t.periodo} className="flex items-center justify-between gap-2">
                <span className="text-neutral-mid">
                  {mesLabel(t.periodo)} · vence {formatDateLike(t.vence)}
                </span>
                <span className="tabular-nums font-medium text-neutral-dark">
                  {formatClp(t.monto)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </QavanteCard>
  );
}

function pctVariacion(
  actual: number | null,
  previo: number | null,
): { text: string; up: boolean } | null {
  if (actual == null || previo == null || previo === 0) return null;
  const pct = ((actual - previo) / Math.abs(previo)) * 100;
  const rounded = Math.round(pct);
  return { text: `${rounded > 0 ? "+" : ""}${rounded}%`, up: pct > 0 };
}

/* ── Tendencia (barras CSS: IVA débito vs crédito por mes) ─────────────── */

function TrendCard({ puntos }: { puntos: F29TendenciaPunto[] }) {
  const max = Math.max(1, ...puntos.flatMap((p) => [p.iva_debito ?? 0, p.iva_credito ?? 0]));
  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-neutral-dark">Tendencia del año</span>
          <div className="flex items-center gap-3 text-xs text-neutral-mid">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-brand-primary" aria-hidden="true" />
              IVA débito (ventas)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-info-500" aria-hidden="true" />
              IVA crédito (compras)
            </span>
          </div>
        </div>
      }
    >
      <div
        className="flex h-40 items-end gap-1 sm:gap-2"
        role="img"
        aria-label="Gráfico de IVA débito y crédito por mes"
      >
        {puntos.map((p) => {
          const deb = p.iva_debito ?? 0;
          const cred = p.iva_credito ?? 0;
          return (
            <div key={p.periodo} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-full w-full items-end justify-center gap-0.5">
                <span
                  style={{ height: `${(deb / max) * 100}%` }}
                  className="w-2 min-h-[2px] rounded-t bg-brand-primary/90 sm:w-3"
                  title={`Débito ${mesAbbr(p.periodo)}: ${money(p.iva_debito)}`}
                />
                <span
                  style={{ height: `${(cred / max) * 100}%` }}
                  className="w-2 min-h-[2px] rounded-t bg-info-500/80 sm:w-3"
                  title={`Crédito ${mesAbbr(p.periodo)}: ${money(p.iva_credito)}`}
                />
              </div>
              <span className="text-[10px] text-neutral-mid">{mesAbbr(p.periodo)}</span>
            </div>
          );
        })}
      </div>
    </QavanteCard>
  );
}

/* ── Tabla anual con semáforo ─────────────────────────────────────────── */

function DeclaracionesCard({
  declaraciones,
  resumen,
  now,
  selected,
  onSelect,
}: {
  declaraciones: F29Declaracion[];
  resumen: F29Resumen;
  now: Date;
  selected: string | null;
  onSelect: (periodo: string) => void;
}) {
  const totalPagado = declaraciones.reduce((acc, d) => acc + (d.monto_pagado ?? 0), 0);

  return (
    <QavanteCard variant="bordered" className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border-strong text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
              <th scope="col" className="py-2.5 pl-4 pr-3 font-semibold">Período</th>
              <th scope="col" className="py-2.5 pr-3 font-semibold">Estado</th>
              <th scope="col" className="py-2.5 pr-3 font-semibold">Vence</th>
              <th scope="col" className="py-2.5 pr-3 text-right font-semibold">Total</th>
              <th scope="col" className="py-2.5 pr-3 text-right font-semibold">Pagado</th>
              <th scope="col" className="py-2.5 pr-3 text-right font-semibold">Posterg.</th>
              <th scope="col" className="py-2.5 pr-3 font-semibold">Cuadra c/Libro</th>
              <th scope="col" className="py-2.5 pr-4" aria-label="Ver detalle" />
            </tr>
          </thead>
          <tbody>
            {declaraciones.map((d) => {
              const status = f29Status(d, now);
              const isSel = selected === d.periodo;
              return (
                <tr
                  key={d.periodo}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isSel}
                  onClick={() => onSelect(d.periodo)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(d.periodo);
                    }
                  }}
                  className={cn(
                    "cursor-pointer border-b border-border/60 transition-colors last:border-b-0",
                    "hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary",
                    isSel && "bg-surface-muted",
                  )}
                >
                  <td className="py-2.5 pl-4 pr-3">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn("h-2.5 w-2.5 flex-shrink-0 rounded-full", TONE_DOT[status.tone])}
                        aria-hidden="true"
                      />
                      <span className="font-medium text-neutral-dark">{mesLabel(d.periodo)}</span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <QavanteBadge variant={TONE_BADGE[status.tone]}>{status.label}</QavanteBadge>
                  </td>
                  <td className="py-2.5 pr-3 text-neutral-dark">{formatDateLike(d.fecha_vencimiento)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-neutral-dark">
                    {money(d.total_a_pagar)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-neutral-dark">
                    {money(d.monto_pagado)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-neutral-mid">
                    {d.iva_postergado ? formatClp(d.iva_postergado) : "—"}
                  </td>
                  <td className="py-2.5 pr-3">
                    <CuadraturaCell decl={d} />
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <ChevronRight
                      className={cn(
                        "inline h-4 w-4 text-neutral-mid transition-transform",
                        isSel && "rotate-90",
                      )}
                      aria-hidden="true"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border-strong text-sm">
              <td colSpan={4} className="py-2.5 pl-4 pr-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                Total del año
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums font-semibold text-neutral-dark">
                {formatClp(totalPagado)}
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-neutral-mid">
                {resumen.iva_postergado_pendiente ? formatClp(resumen.iva_postergado_pendiente) : "—"}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </QavanteCard>
  );
}

function CuadraturaCell({ decl }: { decl: F29Declaracion }) {
  const c = decl.cuadratura_rcv;
  if (!c) return <span className="text-neutral-mid">—</span>;
  if (!c.difiere) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-success-500">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Cuadra
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-500">
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
      Difiere {formatClp(Math.abs(c.delta))}
    </span>
  );
}

/* ── Detalle de una declaración (al clickear la fila) ─────────────────── */

function DetailCard({ declaracion, onClose }: { declaracion: F29Declaracion; onClose: () => void }) {
  const d = declaracion;
  const pdfUrl = d.folio != null ? siiF29PdfUrl(d.folio) : null;

  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-neutral-dark">
            Detalle · {mesLabel(d.periodo)} {d.periodo.slice(0, 4)}
            {d.folio != null && (
              <span className="ml-2 font-mono text-xs text-neutral-mid">folio {d.folio}</span>
            )}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-neutral-mid hover:bg-surface-muted hover:text-neutral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            aria-label="Cerrar detalle"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          <DetailRow label="IVA débito fiscal" value={money(d.iva_debito_fiscal)} />
          <DetailRow label="IVA crédito fiscal" value={money(d.iva_credito_fiscal)} />
          <DetailRow label="PPM" value={money(d.ppm)} />
          <DetailRow label="Remanente crédito" value={money(d.remanente_credito_fiscal)} />
          <DetailRow label="Total a pagar" value={money(d.total_a_pagar)} strong />
          <DetailRow label="Pagado" value={money(d.monto_pagado)} />
          {d.iva_postergado != null && d.iva_postergado > 0 && (
            <DetailRow label="IVA postergado" value={formatClp(d.iva_postergado)} />
          )}
        </dl>

        {d.cuadratura_rcv?.difiere && (
          <p className="flex items-start gap-2 rounded-lg border border-warning-500/30 bg-warning-500/5 p-3 text-xs text-neutral-dark">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-500" aria-hidden="true" />
            El IVA débito del F29 difiere del Libro de Ventas en{" "}
            {formatClp(Math.abs(d.cuadratura_rcv.delta))}. Revisa si hay ventas sin declarar o
            documentos fuera de período.
          </p>
        )}

        {d.observaciones && (
          <p className="flex items-start gap-2 rounded-lg border border-warning-500/30 bg-warning-500/5 p-3 text-xs text-neutral-dark">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-500" aria-hidden="true" />
            {d.observaciones}
          </p>
        )}

        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand-primary px-4 text-sm font-medium text-surface hover:bg-brand-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Descargar PDF del Certificado Solemne
          </a>
        )}
      </div>
    </QavanteCard>
  );
}

function DetailRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-neutral-mid">{label}</dt>
      <dd
        className={cn(
          "tabular-nums text-neutral-dark",
          strong ? "text-base font-semibold" : "text-sm font-medium",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
