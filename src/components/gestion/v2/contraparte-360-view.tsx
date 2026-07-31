"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus, TrendingUp } from "lucide-react";
import { QavanteBadge, QavanteStatTile } from "@/components/qavante";
import { useMaestroDocs } from "@/components/terminos/use-maestro-docs";
import { addMonths, toPeriod, type PeriodRange } from "@/lib/period/period-range";
import { formatClp } from "@/lib/formatters/clp";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import type { DocConVencimiento } from "@/components/terminos/terminos-pago";
import {
  agregarContrapartes,
  concentracionPct,
  estacionalidad,
  montoFirmado,
  periodoDe,
  serieMensual,
  tendenciaAnual,
} from "./contraparte-360-model";

/* Contraparte 360 (pedido de Fernando 2026-07-30): análisis del comportamiento comercial de un
   cliente (ventas) o proveedor (compras) en el tiempo — venta/compra mes a mes, tendencia año contra
   año, estacionalidad, concentración y riesgo. Config-driven: la MISMA vista sirve para los dos 360,
   cambia el lenguaje. Datos del maestro RCV (~24 meses). "Días de pago real" NO se calcula (es el
   comportamiento_pago = brecha CC-API); se declara honesto. Sin `export const runtime` (regla 4). */

const MESES_CORTOS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export interface Config360 {
  kind: "ventas" | "compras";
  /** "cliente" / "proveedor" */
  contraparte: string;
  /** "clientes" / "proveedores" */
  contrapartes: string;
  /** "Facturación" / "Compras" (sustantivo del flujo) */
  flujo: string;
  /** "te factura" no; usamos "le vendes a" / "le compras a" — frase del verbo */
  verbo: string;
  /** "de tus ventas" / "de tus compras" */
  delTotal: string;
}

export function Contraparte360View({ config }: { config: Config360 }) {
  // Ventana de ~24 meses (estacionalidad + año contra año). Memoizada una vez.
  const range: PeriodRange = React.useMemo(() => {
    const hasta = toPeriod(new Date());
    return { desde: addMonths(hasta, -23), hasta };
  }, []);

  const maestro = useMaestroDocs(config.kind, true, range);
  const docs = maestro.docs;

  const agregados = React.useMemo(() => agregarContrapartes(docs), [docs]);
  const totalGlobal = React.useMemo(() => agregados.reduce((s, c) => s + c.total, 0), [agregados]);

  const [rut, setRut] = React.useState<string | null>(null);
  // Default: la contraparte que más pesa (una vez que llegan los datos).
  const rutSel = rut ?? agregados[0]?.rut ?? null;
  const sel = agregados.find((c) => c.rut === rutSel) ?? null;

  if (maestro.isFetching && docs.length === 0) {
    return <div className="h-48 animate-pulse rounded-xl bg-neutral-light/30" aria-busy="true" />;
  }
  if (agregados.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6 text-sm text-neutral-mid">
        Todavía no hay {config.flujo.toLowerCase()} en los últimos 24 meses para analizar.
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <Selector
        agregados={agregados}
        value={rutSel}
        onChange={setRut}
        config={config}
        totalGlobal={totalGlobal}
      />
      {sel && (
        <Detalle
          sel={sel}
          docs={docs}
          desde={range.desde}
          hasta={range.hasta}
          totalGlobal={totalGlobal}
          config={config}
        />
      )}
    </div>
  );
}

/* ---------- Selector de contraparte ---------- */
function Selector({
  agregados,
  value,
  onChange,
  config,
  totalGlobal,
}: {
  agregados: ReturnType<typeof agregarContrapartes>;
  value: string | null;
  onChange: (rut: string) => void;
  config: Config360;
  totalGlobal: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm sm:max-w-md">
      <span className="font-medium text-neutral-dark">Elige un {config.contraparte}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-surface px-3 py-2 font-medium text-neutral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
        aria-label={`Elegir ${config.contraparte}`}
      >
        {agregados.slice(0, 100).map((c) => {
          const pct = concentracionPct(c.total, totalGlobal);
          return (
            <option key={c.rut} value={c.rut}>
              {c.name} · {formatClp(c.total)}
              {pct != null ? ` (${pct.toFixed(0)}%)` : ""}
            </option>
          );
        })}
      </select>
    </label>
  );
}

/* ---------- Detalle 360 de la contraparte seleccionada ---------- */
function Detalle({
  sel,
  docs,
  desde,
  hasta,
  totalGlobal,
  config,
}: {
  sel: ReturnType<typeof agregarContrapartes>[number];
  docs: DocConVencimiento[];
  desde: string;
  hasta: string;
  totalGlobal: number;
  config: Config360;
}) {
  const serie = React.useMemo(
    () => serieMensual(docs, sel.rut, desde, hasta),
    [docs, sel.rut, desde, hasta],
  );
  const tend = tendenciaAnual(serie);
  const est = estacionalidad(serie);
  const pct = concentracionPct(sel.total, totalGlobal);

  // Riesgo: mayor documento y meses desde la última actividad.
  const docsSel = docs.filter((d) => d.rut === sel.rut);
  const mayor = docsSel.reduce((mx, d) => Math.max(mx, montoFirmado(d)), 0);
  const mesesSinActividad = periodDiff(sel.ultimoPeriodo, hasta);

  return (
    <>
      {/* Cabecera */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-lg font-bold text-neutral-dark">{sel.name}</h2>
        <p className="text-xs text-neutral-mid">
          RUT {sel.rut} · activo desde {formatPeriodLabel(sel.primerPeriodo)}
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QavanteStatTile
            label={`${config.flujo} (24 meses)`}
            value={formatClp(sel.total)}
            tone="default"
          />
          <QavanteStatTile
            label={`% ${config.delTotal}`}
            value={pct != null ? `${pct.toFixed(1)}%` : "—"}
            tone={pct != null && pct >= 25 ? "danger" : "default"}
            hint={
              pct != null && pct >= 25
                ? "Concentración alta: dependes mucho de esta contraparte."
                : undefined
            }
          />
          <QavanteStatTile label="Documentos" value={String(sel.docs)} tone="default" />
        </div>
      </section>

      {/* Venta/compra en el tiempo */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-neutral-dark">
          <TrendingUp className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          {config.flujo} mes a mes (últimos 24 meses)
        </div>
        <Barras serie={serie} />
        {tend && <TendenciaLinea tend={tend} config={config} />}
      </section>

      {/* Estacionalidad */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-bold text-neutral-dark">Estacionalidad</h3>
        <p className="text-xs text-neutral-mid">
          Promedio por mes del año — en qué meses concentra.
        </p>
        <Estacional est={est} />
      </section>

      {/* Riesgo + días de pago */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <QavanteStatTile
          label="Documento más grande"
          value={formatClp(mayor)}
          tone="default"
          hint="La mayor factura del período con esta contraparte."
        />
        <QavanteStatTile
          label="Última actividad"
          value={
            mesesSinActividad <= 0
              ? "Este mes"
              : `hace ${mesesSinActividad} ${mesesSinActividad === 1 ? "mes" : "meses"}`
          }
          tone={mesesSinActividad >= 3 ? "danger" : "default"}
          hint={mesesSinActividad >= 3 ? "Sin actividad reciente — posible fuga." : undefined}
        />
      </div>

      <DiasDePago config={config} />

      {/* Últimas facturas */}
      <UltimosDocs docsSel={docsSel} />
    </>
  );
}

/* ---------- Sub-bloques ---------- */
function TendenciaLinea({
  tend,
  config,
}: {
  tend: NonNullable<ReturnType<typeof tendenciaAnual>>;
  config: Config360;
}) {
  const d = tend.deltaPct;
  const sube = (d ?? 0) >= 0;
  const Icon = d == null ? Minus : sube ? ArrowUpRight : ArrowDownRight;
  const color = d == null ? "text-neutral-mid" : sube ? "text-success-700" : "text-danger-500";
  return (
    <p className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-dashed border-border pt-3 text-sm text-neutral-mid">
      <Icon className={`h-4 w-4 ${color}`} aria-hidden="true" />
      Últimos 12 meses <b className="text-neutral-dark">{formatClp(tend.ultimos12)}</b> vs. los 12
      previos <b className="text-neutral-dark">{formatClp(tend.previos12)}</b>
      {d != null && (
        <span className={`font-semibold ${color}`}>
          ({sube ? "+" : ""}
          {d.toFixed(1)}% de {config.flujo.toLowerCase()})
        </span>
      )}
    </p>
  );
}

/** Barras verticales normalizadas al máximo de la serie. Cada columna es `h-full` + `items-end`
 *  para que la altura % de la barra resuelva contra una altura DEFINIDA (si el padre directo no
 *  tiene altura, el % cae a 0 y no se ve nada). */
function Barras({ serie }: { serie: { periodo: string; monto: number }[] }) {
  const max = Math.max(1, ...serie.map((p) => Math.abs(p.monto)));
  return (
    <div className="mt-3 flex h-28 items-end gap-0.5" role="img" aria-label="Serie mensual">
      {serie.map((p) => {
        const h = Math.round((Math.abs(p.monto) / max) * 100);
        const neg = p.monto < 0;
        return (
          <div
            key={p.periodo}
            className="flex h-full flex-1 items-end"
            title={`${p.periodo}: ${formatClp(p.monto)}`}
          >
            <div
              data-testid="serie-barra"
              className={`w-full rounded-t ${neg ? "bg-danger-500/50" : "bg-brand-primary/70"}`}
              style={{ height: `${Math.max(2, h)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** 12 barras Ene–Dic con el promedio; resalta el mes pico. */
function Estacional({ est }: { est: { mes: number; promedio: number }[] }) {
  const max = Math.max(1, ...est.map((e) => Math.abs(e.promedio)));
  const pico = est.reduce((mx, e) => (e.promedio > mx.promedio ? e : mx), est[0]!);
  return (
    <div className="mt-3 flex items-end gap-1">
      {est.map((e) => {
        const h = Math.round((Math.abs(e.promedio) / max) * 100);
        const esPico = e.mes === pico.mes && pico.promedio > 0;
        return (
          <div key={e.mes} className="flex flex-1 flex-col items-center gap-1">
            {/* Caja de altura DEFINIDA (h-20) + items-end para que la barra en % se vea. */}
            <div className="flex h-20 w-full items-end">
              <div
                className={`w-full rounded-t ${esPico ? "bg-brand-primary" : "bg-brand-primary/40"}`}
                style={{ height: `${Math.max(3, h)}%` }}
                title={`${MESES_CORTOS[e.mes - 1]}: ${formatClp(e.promedio)}`}
              />
            </div>
            <span className="text-[9px] text-neutral-mid">{MESES_CORTOS[e.mes - 1]}</span>
          </div>
        );
      })}
    </div>
  );
}

function DiasDePago({ config }: { config: Config360 }) {
  const verbo = config.kind === "ventas" ? "en cobrar" : "en pagar";
  return (
    <section className="rounded-xl border border-warning-500/30 bg-warning-500/[.05] p-4 text-[13px]">
      <p className="font-semibold text-neutral-dark">Días promedio {verbo} — en preparación</p>
      <p className="mt-0.5 text-neutral-mid">
        El comportamiento de pago real (cuánto tarda de verdad, no el plazo pactado) necesita cruzar
        cada factura con su pago en el banco. Ese motor lo está construyendo el backend; en cuanto
        esté, aparece acá con su tendencia (si se está estirando).
      </p>
    </section>
  );
}

function UltimosDocs({ docsSel }: { docsSel: DocConVencimiento[] }) {
  const ultimos = [...docsSel]
    .sort((a, b) => (periodoDe(b.fecha) ?? "").localeCompare(periodoDe(a.fecha) ?? ""))
    .slice(0, 8);
  if (ultimos.length === 0) return null;
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-2 text-sm font-bold text-neutral-dark">Últimos documentos</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-mid">
              <th className="py-1 pr-3 font-semibold">Fecha</th>
              <th className="py-1 pr-3 font-semibold">Folio</th>
              <th className="py-1 pr-3 font-semibold">Tipo</th>
              <th className="py-1 text-right font-semibold">Monto</th>
            </tr>
          </thead>
          <tbody>
            {ultimos.map((d, i) => (
              <tr key={`${d.folio}-${i}`} className="border-t border-border/60">
                <td className="py-1.5 pr-3 tabular-nums text-neutral-dark">{d.fecha}</td>
                <td className="py-1.5 pr-3 tabular-nums text-neutral-mid">{d.folio ?? "—"}</td>
                <td className="py-1.5 pr-3 text-neutral-mid">
                  {d.tipoDoc === 61 || d.tipoDoc === 112 ? "Nota de crédito" : "Factura"}
                  {d.reclamado && (
                    <QavanteBadge variant="warning" className="ml-2">
                      R
                    </QavanteBadge>
                  )}
                </td>
                <td className="py-1.5 text-right font-semibold tabular-nums text-neutral-dark">
                  {formatClp(montoFirmado(d))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Meses de diferencia entre dos períodos "YYYY-MM" (b − a). */
function periodDiff(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  if (!ay || !am || !by || !bm) return 0;
  return (by - ay) * 12 + (bm - am);
}
