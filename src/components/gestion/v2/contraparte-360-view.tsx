"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus, TrendingUp, X } from "lucide-react";
import { QavanteBadge, QavanteStatTile } from "@/components/qavante";
import { useMaestroDocs } from "@/components/terminos/use-maestro-docs";
import { addMonths, comparePeriod, toPeriod, type PeriodRange } from "@/lib/period/period-range";
import { formatClp } from "@/lib/formatters/clp";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import { normalizeRut } from "@/lib/validators/rut";
import type { DocConVencimiento } from "@/components/terminos/terminos-pago";
import {
  agregarContrapartes,
  concentracionPct,
  estacionalidad,
  montoFirmado,
  periodoDe,
  serieMensual,
  sinMesEnCurso,
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

/** "2026-07" → "07-2026" (mes-año, no año-mes). Deja el input si no parsea. */
function mesAnioNum(periodo: string): string {
  const m = periodo.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[2]}-${m[1]}` : periodo;
}

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
  // Traemos ~24 meses (para el año-contra-año y la estacionalidad), pero el FOCO es los ÚLTIMOS
  // 12 MESES (pedido de Fernando): el total, la concentración y las barras son de 12 meses.
  const { range24, desde12 } = React.useMemo(() => {
    const hasta = toPeriod(new Date());
    // 25 meses: el año-contra-año y la estacionalidad EXCLUYEN el mes en curso (parcial) → necesitan
    // 24 meses CERRADOS, que salen de descartar el último de estos 25 (ver `serie24.slice(0,-1)` abajo).
    const range24: PeriodRange = { desde: addMonths(hasta, -24), hasta };
    return { range24, desde12: addMonths(hasta, -11) };
  }, []);

  const maestro = useMaestroDocs(config.kind, true, range24);
  const docs = maestro.docs;

  const { agregados, totalGlobal, primerPorRut } = React.useMemo(() => {
    const docs12 = docs.filter((d) => {
      const p = periodoDe(d.fecha);
      return p != null && comparePeriod(p, desde12) >= 0;
    });
    const ag = agregarContrapartes(docs12);
    // "activo desde" = primer período REAL (ventana completa), no el recorte de 12m.
    const primerPorRut = new Map(agregarContrapartes(docs).map((c) => [c.rut, c.primerPeriodo]));
    return { agregados: ag, totalGlobal: ag.reduce((s, c) => s + c.total, 0), primerPorRut };
  }, [docs, desde12]);

  const [rut, setRut] = React.useState<string | null>(null);
  // Default: la contraparte que más pesa (una vez que llegan los datos).
  const rutSel = rut ?? agregados[0]?.rut ?? null;
  const sel = agregados.find((c) => c.rut === rutSel) ?? null;

  if (maestro.isFetching && docs.length === 0) {
    return <div className="h-48 animate-pulse rounded-xl bg-neutral-light/30" aria-busy="true" />;
  }
  // Error real (todas las consultas fallaron) ≠ "no hay actividad": no afirmamos $0 de ventas.
  if (maestro.isError && docs.length === 0) {
    return (
      <section className="rounded-xl border border-danger-500/40 bg-danger-500/[.06] p-6 text-sm text-neutral-dark">
        No pudimos cargar tus {config.flujo.toLowerCase()} ahora. Reintenta en un momento.
      </section>
    );
  }
  if (agregados.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6 text-sm text-neutral-mid">
        Todavía no hay {config.flujo.toLowerCase()} en los últimos 12 meses para analizar.
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
      {maestro.isFetching && (
        <p className="text-xs text-neutral-light" role="status">
          Cargando más meses… los números pueden ajustarse.
        </p>
      )}
      {sel && (
        <Detalle
          sel={sel}
          docs={docs}
          desde12={desde12}
          desde24={range24.desde}
          hasta={range24.hasta}
          activoDesde={primerPorRut.get(sel.rut) ?? sel.primerPeriodo}
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
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const sel = agregados.find((c) => c.rut === value) ?? null;
  const q = query.trim().toLowerCase();
  const qRut = query.replace(/[.\-\s]/g, "").toLowerCase();
  const filtered = q
    ? agregados.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          // Solo matchea por RUT si el texto tiene dígitos/letras (evita que "." matchee todo).
          (qRut !== "" &&
            c.rut
              .replace(/[.\-\s]/g, "")
              .toLowerCase()
              .includes(qRut)),
      )
    : agregados;

  const elegir = (rut: string) => {
    onChange(rut);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="relative sm:max-w-md">
      <label htmlFor="cp360-buscar" className="text-sm font-medium text-neutral-dark">
        Busca un {config.contraparte} por nombre o RUT
      </label>
      {/* El input es SIEMPRE un buscador (empieza vacío); la selección actual va como placeholder
          → para cambiar de contraparte no hay que borrar texto a mano, solo escribir o elegir. */}
      <div className="relative mt-1">
        <input
          id="cp360-buscar"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="cp360-lista"
          autoComplete="off"
          value={query}
          placeholder={sel ? `${sel.name} · ${formatClp(sel.total)}` : "Nombre o RUT…"}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            // Teclado: Enter elige el primer resultado (solo si estás buscando); Escape cierra.
            if (e.key === "Enter" && q && filtered.length > 0) {
              e.preventDefault();
              elegir(filtered[0]!.rut);
            } else if (e.key === "Escape") {
              setOpen(false);
              e.currentTarget.blur();
            }
          }}
          onBlur={() =>
            window.setTimeout(() => {
              setOpen(false);
              setQuery("");
            }, 150)
          }
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 pr-9 text-sm font-medium text-neutral-dark placeholder:font-normal placeholder:text-neutral-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
        />
        {query && (
          <button
            type="button"
            aria-label="Borrar búsqueda"
            onMouseDown={(e) => {
              e.preventDefault();
              setQuery("");
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-mid hover:text-neutral-dark"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {open && (
        <ul
          id="cp360-lista"
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {filtered.slice(0, 60).map((c) => {
            const pct = concentracionPct(c.total, totalGlobal);
            return (
              <li key={c.rut} role="option" aria-selected={c.rut === value}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    elegir(c.rut);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm hover:bg-brand-primary-50"
                >
                  <span className="min-w-0 truncate text-neutral-dark">{c.name}</span>
                  <span className="shrink-0 tabular-nums text-neutral-mid">
                    {formatClp(c.total)}
                    {pct != null ? ` (${pct.toFixed(0)}%)` : ""}
                  </span>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-neutral-mid">Sin resultados para “{query}”.</li>
          )}
        </ul>
      )}
    </div>
  );
}

/* ---------- Detalle 360 de la contraparte seleccionada ---------- */
function Detalle({
  sel,
  docs,
  desde12,
  desde24,
  hasta,
  activoDesde,
  totalGlobal,
  config,
}: {
  sel: ReturnType<typeof agregarContrapartes>[number];
  docs: DocConVencimiento[];
  desde12: string;
  desde24: string;
  hasta: string;
  activoDesde: string;
  totalGlobal: number;
  config: Config360;
}) {
  // Barras + total: últimos 12 meses (foco; el último es el mes en curso, "hasta hoy"). Año-contra-año
  // + estacionalidad: 24 meses CERRADOS — se descarta el mes en curso (parcial), que si no compararía
  // 11 meses completos + medio mes contra 12 completos (peras con manzanas) y hundiría el %/promedio.
  const serie12 = React.useMemo(
    () => serieMensual(docs, sel.rut, desde12, hasta),
    [docs, sel.rut, desde12, hasta],
  );
  const serie24Cerrada = React.useMemo(
    // 25 meses del fetch → se descarta el mes en curso → 24 meses cerrados.
    () => sinMesEnCurso(serieMensual(docs, sel.rut, desde24, hasta)),
    [docs, sel.rut, desde24, hasta],
  );
  const tend = tendenciaAnual(serie24Cerrada);
  const est = estacionalidad(serie24Cerrada);
  const pct = concentracionPct(sel.total, totalGlobal);

  // Riesgo: mayor documento y meses desde la última actividad.
  const docsSel = docs.filter((d) => normalizeRut(d.rut) === sel.rut);
  // "Documento más grande" del período de FOCO (últimos 12 meses), coherente con el resto de la vista.
  const mayor = docsSel
    .filter((d) => {
      const p = periodoDe(d.fecha);
      return p != null && comparePeriod(p, desde12) >= 0;
    })
    .reduce((mx, d) => Math.max(mx, montoFirmado(d)), 0);
  const mesesSinActividad = periodDiff(sel.ultimoPeriodo, hasta);

  return (
    <>
      {/* Cabecera */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-lg font-bold text-neutral-dark">{sel.name}</h2>
        <p className="text-xs text-neutral-mid">
          RUT {sel.rut} · activo desde {formatPeriodLabel(activoDesde)}
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QavanteStatTile
            label={`${config.flujo} (últimos 12 meses)`}
            value={formatClp(sel.total)}
            tone="default"
          />
          <QavanteStatTile
            label={`% ${config.delTotal}`}
            value={pct != null ? `${pct.toFixed(1)}%` : "s/d"}
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
          {config.flujo} mes a mes (últimos 12 meses)
        </div>
        <Barras serie={serie12} />
        {tend && <TendenciaLinea tend={tend} config={config} />}
      </section>

      {/* Recuperación: mes en curso vs. el mejor mes → cuánto hay para recuperar */}
      <Recuperacion serie={serie12} config={config} />

      {/* Estacionalidad */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-bold text-neutral-dark">Estacionalidad</h3>
        <p className="text-xs text-neutral-mid">
          Promedio por mes del año: en qué meses concentra.
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
          hint={mesesSinActividad >= 3 ? "Sin actividad reciente, posible fuga." : undefined}
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
/** Recuperación: último mes CERRADO vs. el MEJOR mes de la serie → cuánto hay para recuperar (ventas)
 *  o cuánto bajó la relación (compras). Responde "¿qué debería recuperar de este cliente?".
 *  El último punto de la serie es el mes EN CURSO (parcial: recién empieza) → NO se compara: daría
 *  una falsa "fuga" (día 1 = $0 vs su mejor mes). Se usa el último mes cerrado. */
function Recuperacion({
  serie,
  config,
}: {
  serie: { periodo: string; monto: number }[];
  config: Config360;
}) {
  // Excluye el mes en curso (el último de la serie) — parcial, no comparable con meses completos.
  const completos = sinMesEnCurso(serie);
  if (completos.length === 0) return null;
  const mejor = completos.reduce((mx, p) => (p.monto > mx.monto ? p : mx), completos[0]!);
  const actual = completos[completos.length - 1]!;
  if (mejor.monto <= 0) return null;
  const dif = mejor.monto - actual.monto; // + = por debajo de su mejor mes
  const pct = (actual.monto / mejor.monto) * 100 - 100; // negativo = bajo el pico
  const bajo = dif > 0;
  const esVentas = config.kind === "ventas";
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h3 className="text-sm font-bold text-neutral-dark">
        {esVentas
          ? "A recuperar (último mes cerrado vs. su mejor mes)"
          : "Último mes cerrado vs. su mayor mes"}
      </h3>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QavanteStatTile
          label="Mejor mes"
          value={formatClp(mejor.monto)}
          tone="default"
          hint={mesAnioNum(mejor.periodo)}
        />
        <QavanteStatTile
          label="Último mes cerrado"
          value={formatClp(actual.monto)}
          tone="default"
          hint={mesAnioNum(actual.periodo)}
        />
        <QavanteStatTile
          label={esVentas ? "A recuperar" : "Diferencia"}
          value={`${bajo ? "" : "+"}${formatClp(Math.abs(dif))}`}
          tone={bajo ? "danger" : "success"}
          hint={`${pct >= 0 ? "+" : ""}${pct.toFixed(0)}% vs. su mejor mes`}
        />
      </div>
    </section>
  );
}

function Barras({ serie }: { serie: { periodo: string; monto: number }[] }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const max = Math.max(1, ...serie.map((p) => Math.abs(p.monto)));
  // Al pasar el mouse muestra el mes (YYYY-MM) + su valor; por defecto, el último mes.
  const activo = hover != null ? serie[hover] : serie[serie.length - 1];
  return (
    <div>
      <div className="mt-3 flex h-28 items-end gap-0.5" role="img" aria-label="Serie mensual">
        {serie.map((p, i) => {
          const h = Math.round((Math.abs(p.monto) / max) * 100);
          const neg = p.monto < 0;
          const on = i === hover;
          return (
            <div
              key={p.periodo}
              className="flex h-full flex-1 items-end"
              title={`${p.periodo}: ${formatClp(p.monto)}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div
                data-testid="serie-barra"
                className={`w-full rounded-t transition-colors ${
                  neg ? "bg-danger-500/50" : on ? "bg-brand-primary" : "bg-brand-primary/70"
                }`}
                style={{ height: `${Math.max(2, h)}%` }}
              />
            </div>
          );
        })}
      </div>
      {activo && (
        <p className="mt-2 text-sm font-semibold text-neutral-dark">
          <span className="tabular-nums">{mesAnioNum(activo.periodo)}</span> ·{" "}
          <span className="tabular-nums">{formatClp(activo.monto)}</span>
        </p>
      )}
    </div>
  );
}

/** 12 barras Ene–Dic con el promedio; resalta el mes pico y muestra el valor al pasar el mouse. */
function Estacional({ est }: { est: { mes: number; promedio: number }[] }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const max = Math.max(1, ...est.map((e) => Math.abs(e.promedio)));
  const pico = est.reduce((mx, e) => (e.promedio > mx.promedio ? e : mx), est[0]!);
  const activo = hover != null ? est[hover] : pico;
  return (
    <div>
      <div className="mt-3 flex items-end gap-1">
        {est.map((e, i) => {
          const h = Math.round((Math.abs(e.promedio) / max) * 100);
          const esPico = e.mes === pico.mes && pico.promedio > 0;
          const on = i === hover;
          return (
            <div
              key={e.mes}
              className="flex flex-1 flex-col items-center gap-1"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {/* Caja de altura DEFINIDA (h-20) + items-end para que la barra en % se vea. */}
              <div className="flex h-20 w-full items-end">
                <div
                  className={`w-full rounded-t transition-colors ${
                    on || esPico ? "bg-brand-primary" : "bg-brand-primary/40"
                  }`}
                  style={{ height: `${Math.max(3, h)}%` }}
                  title={`${MESES_CORTOS[e.mes - 1]}: ${formatClp(e.promedio)}`}
                />
              </div>
              <span className="text-[9px] text-neutral-mid">{MESES_CORTOS[e.mes - 1]}</span>
            </div>
          );
        })}
      </div>
      {activo && activo.promedio > 0 && (
        <p className="mt-1 text-xs text-neutral-mid">
          <b className="text-neutral-dark">{MESES_CORTOS[activo.mes - 1]}</b> · promedio{" "}
          {formatClp(activo.promedio)}
        </p>
      )}
    </div>
  );
}

function DiasDePago({ config }: { config: Config360 }) {
  const verbo = config.kind === "ventas" ? "en cobrar" : "en pagar";
  return (
    <section className="rounded-xl border border-warning-500/30 bg-warning-500/[.05] p-4 text-[13px]">
      <p className="font-semibold text-neutral-dark">Días promedio {verbo}: en preparación</p>
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
                <td className="py-1.5 pr-3 tabular-nums text-neutral-mid">{d.folio ?? "s/d"}</td>
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
