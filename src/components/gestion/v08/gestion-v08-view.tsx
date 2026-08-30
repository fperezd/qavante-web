"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { rovingIndex } from "@/lib/a11y/roving";
import type {
  OperationalResultAlDia,
  OperationalResultBreakdown,
  OperationalResultDocuments,
  OperationalResultResponse,
} from "@/lib/api/gestion";
import type { CashCycleResponse } from "@/lib/api/treasury";
import type { DashboardSummaryResponse } from "@/lib/api/dashboard";
import type { DocConVencimiento } from "@/components/terminos/terminos-pago";
import { formatClp, formatClpBare } from "@/lib/formatters/clp";
import { formatPct } from "@/lib/formatters/pct";
import { formatCount, formatDays } from "@/lib/formatters/count";
import { formatDateLong } from "@/lib/formatters/date";
import { MESES_CORTOS } from "@/lib/formatters/months";
import { parseSiiDate } from "@/components/terminos/terminos-pago";
import { currentPeriodSantiago, formatPeriodLabel } from "../gestion-format";
import { Banner } from "@/components/rediseno/banner";
import { DataState } from "@/components/rediseno/data-state";
import { KpiCard } from "@/components/rediseno/kpi-card";
import { Pill } from "@/components/rediseno/pill";
import { RedisenoTable, TablePrimaryCell } from "@/components/rediseno/table";
import {
  TABS_V08,
  TAB_LABEL,
  TAB_PREGUNTA,
  chequeoLey1,
  comparativoAlDia,
  confianzaDato,
  costosDelMes,
  csv360,
  csvComparativo,
  csvCostos,
  csvPivote,
  equilibrioResumen,
  excepcionesFooter,
  filasPivote,
  filtrar360,
  ingredientesInsight,
  ingresoPivote,
  kpisCiclo,
  kpisMargen,
  lista360,
  perfil360,
  resolverDrill,
  resultadoDelMes,
  resultadoPivote,
  tendencia,
  UMBRAL_CONCENTRACION_PCT,
  type FilaPivote,
  type LineaCosto,
  type DocContraparte,
  type TabV08,
} from "./gestion-v08-model";

/* V08 · Gestión — "¿gano o pierdo?" en SEIS tabs (rediseño Fase 2, issue #72).
 *
 * PRESENTACIONAL: entran respuestas, sale una pantalla. Sin hooks de datos — el cableado vive en
 * `gestion-v08-live.tsx`, que además decide QUÉ pedir según la tab activa (por eso la tab es una
 * prop controlada y no estado interno: las 12 queries del maestro RCV de los 360 no se disparan
 * mientras el usuario mira el Resultado).
 *
 * LEY 1 — el titular del Resultado publica `operational_result.result` del summary: el MISMO campo
 * que el strip de V01 · Hoy. El pivote publica el árbol del breakdown, que es el único que se abre
 * por cuenta. Los dos se COMPARAN (`chequeoLey1`): si difieren, la pantalla muestra los dos números
 * con su fuente en vez de elegir uno en silencio. Y el "Margen neto" del tab Márgenes sale del
 * mismo `result` del mes, así que ninguna tab contradice a otra.
 *
 * LEY 2 — máximo UN rojo, y en el caso normal CERO (§5.3 pide que exista una pantalla sin ningún
 * rojo). El rojo se reserva a lo crítico Y accionable: la divergencia entre los dos motores del
 * P&L (hay que ir a mirar cuál está mal) o un drill-down que no suma su total. Un mes en pérdida
 * NO va en rojo: es grave, pero no hay un botón que lo arregle.
 *
 * LEY 7 — sin scroll horizontal, MEDIDO en Chromium a 346 px: el mínimo de la spec es 360, pero
 * se mide catorce píxeles por debajo porque el ancho de la fuente cambia entre sistemas y una
 * medición justo en el borde pasa en una máquina y falla en otra (ver las tres stories `Ley 7 · …
 * a 346 px`). El pivote es una tabla propia (no `RedisenoTable`) porque necesita filas expandibles en
 * dos niveles; las columnas de los meses VIEJOS se colapsan en viewport angosto
 * (`hidden sm:table-cell`) y quedan el concepto, el mes más reciente y la variación. El concepto y
 * los montos jamás se ocultan ni se truncan: el label envuelve.
 *
 * Lo que la medición enseñó, y por eso vale la pena escribirlo acá: en este design system las
 * tablas viven dentro de una tarjeta `overflow-hidden`, así que un contenido más ancho que la
 * pantalla NO produce scroll — se recorta en silencio, y `document.scrollWidth` no se entera. Medir
 * sólo el scroll da un verde falso. La medición de las stories exige además que ninguna tabla ni
 * tarjeta termine más allá del borde derecho de la ventana, y con esa versión aparecieron dos
 * desbordes reales que la lectura del código no había visto: el `colSpan` de las filas del
 * drill-down (369 px) y el `sub` largo de la tabla de costos, que `truncate` vuelve `nowrap` y
 * empujaba la columna a 438 px. Los dos están arreglados; los dos vuelven a romper el test si se
 * revierten.
 *
 * HUECOS DECLARADOS — el export xls no existe en el backend: se exporta CSV, que es exacto sobre lo
 * mostrado, y se anuncia por su nombre. "Días promedio en pagar" del 360 conserva su "en
 * preparación" honesto. */

export interface GestionV08ViewProps {
  tab: TabV08;
  onTabChange: (tab: TabV08) => void;

  /** `GET /api/dashboard/summary` — la fuente de "Resultado mes" de V01 (Ley 1). */
  summary: DashboardSummaryResponse | null;
  /** `GET /api/management/operational-result/breakdown` — 3 meses (el pivote). */
  breakdown: OperationalResultBreakdown | null;
  /** El mismo endpoint, rango largo — la serie de Tendencia. */
  breakdownLargo?: OperationalResultBreakdown | null;
  /** `GET /api/management/operational-result?period=` — los KPI de Márgenes. */
  mes?: OperationalResultResponse | null;
  /** `GET .../al-dia?period=<mes en curso>&hasta_dia=N`. */
  alDia?: OperationalResultAlDia | null;
  /** `GET .../al-dia?period=<mes anterior>&hasta_dia=31` — la referencia gris, MISMO motor. */
  alDiaPrevioCompleto?: OperationalResultAlDia | null;
  /** `GET /api/treasury/cash-cycle`. */
  ciclo?: CashCycleResponse | null;

  /** Maestro RCV de la tab 360 activa (ventas para Clientes, compras para Proveedores). */
  docs360?: ReadonlyArray<DocConVencimiento> | null;
  docs360Cargando?: boolean;

  /** Celda del pivote abierta (cuenta + mes) y su respuesta. */
  drill?: DrillAbierto | null;
  drillDocs?: OperationalResultDocuments | null;
  drillCargando?: boolean;
  onDrill?: (d: DrillAbierto | null) => void;

  /** Por qué no llegó cada fuente, en lenguaje de dueño. */
  motivos?: Partial<Record<"resultado" | "comparativo" | "ciclo" | "contrapartes", string>>;
  onReintentar?: () => void;
  hoy?: Date;
  issueSucesor?: string;
}

export interface DrillAbierto {
  account: string;
  label: string;
  period: string;
}

const LINK =
  "rounded font-semibold text-rediseno-azul hover:underline focus-visible:ring-2 focus-visible:ring-rediseno-azul focus-visible:outline-none";
const EYEBROW =
  "font-rediseno-mono text-[11px] font-semibold tracking-[.12em] text-rediseno-tinta-3 uppercase";
const CRUMB = "font-rediseno-mono text-[11px] tracking-[.12em] text-rediseno-tinta-3 uppercase";

export function GestionV08View(props: GestionV08ViewProps) {
  const { tab, onTabChange, hoy = new Date() } = props;

  return (
    <div className="space-y-5">
      <div className={CRUMB}>Gestión · {TAB_LABEL[tab]}</div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-3">
        <h1 className="font-rediseno-serif text-[26px] leading-tight font-medium text-rediseno-tinta sm:text-[30px]">
          {TAB_PREGUNTA[tab]}
        </h1>
        <Tabs value={tab} onChange={onTabChange} />
      </div>

      {tab === "resultado" && <TabResultado {...props} hoy={hoy} />}
      {tab === "margenes" && <TabMargenes {...props} />}
      {tab === "tendencia" && <TabTendencia {...props} />}
      {tab === "comparativo" && <TabComparativo {...props} />}
      {(tab === "clientes" || tab === "proveedores") && <Tab360 {...props} />}
    </div>
  );
}

/* ────────────────────────── Tabs ────────────────────────── */

function Tabs({ value, onChange }: { value: TabV08; onChange: (t: TabV08) => void }) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  return (
    <div
      role="tablist"
      aria-label="Vistas de Gestión"
      className="flex flex-wrap items-center gap-1 rounded-full border border-rediseno-hairline bg-rediseno-superficie p-1 sm:ml-auto"
    >
      {TABS_V08.map((t, i) => {
        const activo = t === value;
        return (
          <button
            key={t}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${t}`}
            aria-selected={activo}
            aria-controls={`panel-${t}`}
            tabIndex={activo ? 0 : -1}
            onClick={() => onChange(t)}
            onKeyDown={(e) => {
              const next = rovingIndex(i, e.key, TABS_V08.length);
              if (next === null) return;
              e.preventDefault();
              const destino = TABS_V08[next];
              if (!destino) return;
              onChange(destino);
              refs.current[next]?.focus();
            }}
            className={cn(
              "rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-rediseno-tinta-2",
              "focus-visible:ring-2 focus-visible:ring-rediseno-azul focus-visible:outline-none",
              activo && "bg-rediseno-tinta text-white",
            )}
          >
            {TAB_LABEL[t]}
          </button>
        );
      })}
    </div>
  );
}

function Panel({ tab, children }: { tab: TabV08; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="space-y-5">
      {children}
    </div>
  );
}

/* ────────────────────────── Tab Resultado ────────────────────────── */

function TabResultado({
  summary,
  breakdown,
  drill,
  drillDocs,
  drillCargando,
  onDrill,
  motivos,
  onReintentar,
  issueSucesor,
}: GestionV08ViewProps & { hoy: Date }) {
  if (!breakdown) {
    return (
      <Panel tab="resultado">
        <DataState
          status="error"
          what="tu Estado de Resultados"
          cause={
            motivos?.resultado ??
            "El motor de gestión no respondió. Vuelve a intentar en un momento; si sigue igual, revisa tus conexiones."
          }
          action={onReintentar ? { label: "Reintentar", onClick: onReintentar } : undefined}
        />
      </Panel>
    );
  }

  const months = breakdown.months ?? [];
  const ultimoMes = months[months.length - 1] ?? null;
  const filas = filasPivote(breakdown);
  const resultadoV01 = resultadoDelMes(summary);
  const chequeo = chequeoLey1(
    resultadoV01,
    ultimoMes ? resultadoPivote(filas, ultimoMes) : null,
    ultimoMes,
  );
  const ingreso = ultimoMes ? ingresoPivote(filas, ultimoMes) : null;
  const anterior = months.length >= 2 ? resultadoPivote(filas, months[months.length - 2]!) : null;
  const insight = ingredientesInsight(resultadoV01, ingreso, anterior);
  const excepciones = excepcionesFooter(breakdown);
  const drillResuelto = resolverDrill(drillDocs);

  /* Ley 2 — el ÚNICO rojo posible de esta tab, decidido acá y en un solo lugar. Si los dos motores
     del P&L están de acuerdo y el drill-down cuadra, la pantalla NO tiene ningún rojo. */
  const rojo: "ley1" | "drill" | null = chequeo.divergen
    ? "ley1"
    : drillResuelto?.descuadra
      ? "drill"
      : null;

  return (
    <Panel tab="resultado">
      {chequeo.divergen && (
        /* Ley 2 — ÚN elemento lleva el token rojo (el borde del aviso), no el borde y además el
           texto: dos nodos con la misma clase se cuentan como dos rojos en la pantalla. */
        <div
          className={cn(
            "rounded-xl border border-rediseno-hairline border-l-[3px] bg-rediseno-superficie px-4 py-3 text-[13.5px] text-rediseno-tinta-2",
            rojo === "ley1" ? "border-l-rediseno-rojo" : "border-l-rediseno-ambar-border",
          )}
        >
          <b>
            Dos motores publican un resultado distinto para{" "}
            {chequeo.periodo ? formatPeriodLabel(chequeo.periodo) : "el mes"}.
          </b>{" "}
          El Inicio muestra <b>{formatClp(chequeo.v01 ?? 0)}</b> (
          <span className="font-rediseno-mono text-[11px]">/api/dashboard/summary</span>) y este
          cuadro suma <b>{formatClp(chequeo.pivote ?? 0)}</b> (
          <span className="font-rediseno-mono text-[11px]">
            /api/management/operational-result/breakdown
          </span>
          ) — una diferencia de <b>{formatClp(chequeo.diferencia ?? 0)}</b>. No elegimos uno por ti:
          hasta que cuadren, trata las dos cifras como estimaciones.
        </div>
      )}

      {insight ? (
        <p
          className={cn(
            "text-[15px] leading-relaxed text-rediseno-tinta-2",
            insight.positivo && "text-rediseno-tinta-2",
          )}
        >
          {ultimoMes ? `${capitalizar(formatPeriodLabel(ultimoMes))} va con ` : "El mes va con "}
          <b className={insight.positivo ? "text-rediseno-verde" : "text-rediseno-tinta"}>
            {formatClp(insight.resultado)}
          </b>{" "}
          de resultado
          {insight.margenPct != null && <> (margen {formatPct(insight.margenPct)})</>}
          {insight.deltaVsAnterior != null && (
            <>
              {" — "}
              {formatClp(Math.abs(insight.deltaVsAnterior))}{" "}
              {insight.deltaVsAnterior >= 0 ? "mejor" : "bajo"} el mes anterior
            </>
          )}
          . <span className="text-rediseno-tinta-3">Es el mismo número que muestra el Inicio.</span>
        </p>
      ) : (
        <p className="text-[13.5px] text-rediseno-tinta-3">
          Todavía no sabemos tu resultado del mes: el Inicio no publicó la cifra. El cuadro de abajo
          sí trae el detalle por cuenta.
        </p>
      )}

      <Pivote
        filas={filas}
        months={months}
        drill={drill ?? null}
        drillResuelto={drillResuelto}
        drillCargando={drillCargando ?? false}
        onDrill={onDrill}
        rojoDrill={rojo === "drill"}
        excepciones={excepciones}
      />

      <SeccionCostos filas={filas} periodo={ultimoMes} issueSucesor={issueSucesor} />
    </Panel>
  );
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Concordancia número (singular/plural) del español, en un solo lugar.
 *
 * Regla: sólo `n === 1` toma la forma singular — `0` es plural en español ("0 meses" es correcto,
 * no "0 mes"). Un texto con conteo NUNCA antepone un numeral fijo a un sustantivo/artículo/verbo que
 * no concuerde ("Los 1 proveedores"); esta función es el único punto que decide esa concordancia en
 * este archivo, para que no se repita el patrón (dos veces: proveedores/clientes y documentos).
 *
 * Cuando el singular NO es sólo cambiar la terminación (un artículo plural, un verbo en plural, un
 * pronombre plural), pásale la FRASE completa de cada forma — no sólo la palabra — para que la
 * concordancia sea real y no sólo "1 proveedor" pegado a un verbo en plural. */
function concordar<T>(n: number, singular: T, plural: T): T {
  return n === 1 ? singular : plural;
}

/** Etiqueta corta del mes para una columna: "may 26". */
function columnaMes(periodo: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periodo);
  if (!m) return periodo;
  return `${MESES_CORTOS[Number(m[2]) - 1] ?? periodo} ${m[1]!.slice(2)}`;
}

/* ────────────────────────── El pivote ────────────────────────── */

interface PivoteProps {
  filas: FilaPivote[];
  months: string[];
  drill: DrillAbierto | null;
  drillResuelto: ReturnType<typeof resolverDrill>;
  drillCargando: boolean;
  onDrill?: (d: DrillAbierto | null) => void;
  rojoDrill: boolean;
  excepciones: ReturnType<typeof excepcionesFooter>;
}

const TD = "px-2 py-2.5 align-top text-rediseno-tinta-2 sm:px-[18px]";
const TH =
  "px-2 py-[11px] text-left font-rediseno-mono text-[10px] font-semibold tracking-[.1em] text-rediseno-tinta-3-light uppercase sm:px-[18px]";
const MONTO = "text-right font-semibold text-rediseno-tinta tabular-nums whitespace-nowrap";

function Pivote({
  filas,
  months,
  drill,
  drillResuelto,
  drillCargando,
  onDrill,
  rojoDrill,
  excepciones,
}: PivoteProps) {
  /* Las secciones arrancan ABIERTAS: el pivote existe para ver las cuentas, y el drill-down al
     documento cuelga de ellas. Colapsarlas por defecto escondería el contenido detrás de un clic
     que nadie pidió. */
  const [abiertas, setAbiertas] = React.useState<ReadonlySet<string>>(
    () => new Set(filas.filter((f) => f.hijos.length > 0).map((f) => f.key)),
  );
  const ultimo = months.length - 1;

  const toggleSeccion = (key: string) =>
    setAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="overflow-hidden rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie">
      <table className="w-full text-[13px] sm:text-[13.5px]">
        <caption className="sr-only">
          Estado de Resultados por cuenta, {months.length}{" "}
          {concordar(months.length, "mes", "meses")}. Cada cuenta se abre hasta el documento.
        </caption>
        <thead className="bg-[#FAFBFD]">
          <tr className="border-b border-rediseno-hairline">
            <th scope="col" className={TH}>
              Concepto
            </th>
            {months.map((m, i) => (
              <th
                key={m}
                scope="col"
                /* Ley 7 — en viewport angosto sólo queda el mes MÁS RECIENTE. Los meses viejos son contexto;
                   el concepto y el monto del mes en curso, no. Ninguno de los dos se oculta. */
                className={cn(TH, "text-right", i !== ultimo && "hidden sm:table-cell")}
              >
                {columnaMes(m)}
              </th>
            ))}
            <th scope="col" className={cn(TH, "text-right")}>
              vs. mes previo
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const abierta = abiertas.has(f.key);
            return (
              <React.Fragment key={f.key}>
                <tr className="border-b border-rediseno-hairline-row-2">
                  <td className={cn(TD, "text-rediseno-tinta")}>
                    {f.drill === "hijos" ? (
                      <button
                        type="button"
                        onClick={() => toggleSeccion(f.key)}
                        aria-expanded={abierta}
                        className={cn(
                          "flex items-start gap-1 text-left font-semibold",
                          "rounded focus-visible:ring-2 focus-visible:ring-rediseno-azul focus-visible:outline-none",
                        )}
                      >
                        {abierta ? (
                          <ChevronDown className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        ) : (
                          <ChevronRight className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        )}
                        <span>{f.label}</span>
                      </button>
                    ) : (
                      <span className="font-bold">{f.label}</span>
                    )}
                  </td>
                  {f.celdas.map((c, i) => (
                    <td
                      key={c.periodo}
                      className={cn(TD, MONTO, i !== ultimo && "hidden sm:table-cell")}
                    >
                      {c.monto == null ? (
                        <span className="text-rediseno-tinta-3-light">s/d</span>
                      ) : (
                        formatClpBare(c.monto)
                      )}
                    </td>
                  ))}
                  <td className={cn(TD, MONTO)}>
                    {f.variacionPct == null ? (
                      <span className="text-rediseno-tinta-3-light">—</span>
                    ) : (
                      formatPct(f.variacionPct, { signed: true })
                    )}
                  </td>
                </tr>

                {abierta &&
                  f.hijos.map((h) => {
                    const mesAbierto = drill?.account === h.key ? drill.period : null;
                    return (
                      <React.Fragment key={h.key}>
                        <tr className="border-b border-rediseno-hairline-row-2 bg-[#FCFDFE]">
                          <td className={cn(TD, "pl-7 sm:pl-10")}>{h.label}</td>
                          {h.celdas.map((c, i) => (
                            <td
                              key={c.periodo}
                              className={cn(TD, MONTO, i !== ultimo && "hidden sm:table-cell")}
                            >
                              {c.monto == null ? (
                                <span className="text-rediseno-tinta-3-light">s/d</span>
                              ) : (
                                <button
                                  type="button"
                                  className={LINK}
                                  aria-expanded={mesAbierto === c.periodo}
                                  onClick={() =>
                                    onDrill?.(
                                      mesAbierto === c.periodo
                                        ? null
                                        : {
                                            account: h.key,
                                            label: h.label,
                                            period: c.periodo,
                                          },
                                    )
                                  }
                                >
                                  {formatClpBare(c.monto)}
                                </button>
                              )}
                            </td>
                          ))}
                          <td className={cn(TD, MONTO)}>
                            {h.variacionPct == null ? (
                              <span className="text-rediseno-tinta-3-light">—</span>
                            ) : (
                              formatPct(h.variacionPct, { signed: true })
                            )}
                          </td>
                        </tr>

                        {mesAbierto != null && (
                          <FilasDocumentos
                            months={months}
                            ultimo={ultimo}
                            label={h.label}
                            periodo={mesAbierto}
                            resuelto={drillResuelto}
                            cargando={drillCargando}
                            rojo={rojoDrill}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-rediseno-hairline-row px-3 py-[11px] text-[12.5px] text-rediseno-tinta-3-light sm:px-[18px]">
        <button
          type="button"
          className={LINK}
          onClick={() => descargarCsv("gestion-resultado.csv", csvPivote(filas, months))}
        >
          ⬇ Exportar CSV
        </button>
        <span>· devengado, sin IVA ·</span>
        <span>
          {excepciones.n == null ? (
            <>
              no sabemos cuántas excepciones quedan fuera de este cuadro (el motor no publicó el
              conteo)
            </>
          ) : (
            <>
              no incluye {formatCount(excepciones.n)}{" "}
              {concordar(excepciones.n, "excepción", "excepciones")} · {excepciones.apellido}
            </>
          )}
        </span>
      </div>
    </div>
  );
}

/* Las filas del drill-down respetan la MISMA grilla de columnas que el resto de la tabla: una
   celda por mes, con el monto en la columna del mes abierto y las columnas viejas colapsadas
   igual que arriba.

   No es cosmético. La primera versión ponía el monto en un `colSpan` calculado sobre TODOS los
   meses, y como en angosto dos de esas columnas van en `display:none`, el span obligaba al
   navegador a materializar columnas que la cabecera ya no tenía: la tabla crecía a 369 px dentro
   de una ventana de 360 y el dato se recortaba contra el borde del contenedor —que es
   `overflow-hidden`, así que ni siquiera aparecía una barra de scroll que delatara el problema.
   Lo encontró la medición de la Ley 7 en Chromium, no la lectura del código. */
function FilasDocumentos({
  months,
  ultimo,
  label,
  periodo,
  resuelto,
  cargando,
  rojo,
}: {
  months: string[];
  ultimo: number;
  label: string;
  periodo: string;
  resuelto: ReturnType<typeof resolverDrill>;
  cargando: boolean;
  rojo: boolean;
}) {
  const colSpan = months.length + 2;
  if (cargando) {
    return (
      <tr className="border-b border-rediseno-hairline-row-2 bg-rediseno-porcelana">
        <td colSpan={colSpan} className={cn(TD, "text-[12.5px] text-rediseno-tinta-3")}>
          Estamos trayendo los documentos de {label} en {formatPeriodLabel(periodo)} (~3 s).
        </td>
      </tr>
    );
  }
  if (!resuelto) {
    return (
      <tr className="border-b border-rediseno-hairline-row-2 bg-rediseno-porcelana">
        <td colSpan={colSpan} className={cn(TD, "text-[12.5px] text-rediseno-tinta-3")}>
          No pudimos traer los documentos de {label}. Vuelve a intentar en un momento.
        </td>
      </tr>
    );
  }
  if (resuelto.documentos.length === 0) {
    return (
      <tr className="border-b border-rediseno-hairline-row-2 bg-rediseno-porcelana">
        <td colSpan={colSpan} className={cn(TD, "text-[12.5px] text-rediseno-tinta-3")}>
          Consultamos y esta cuenta no tiene documentos en {formatPeriodLabel(periodo)}. Este cero
          es real.
        </td>
      </tr>
    );
  }
  return (
    <>
      {resuelto.documentos.map((d, i) => (
        <tr
          key={`${d.folio ?? "s-folio"}-${i}`}
          className="border-b border-rediseno-hairline-row-2 bg-rediseno-porcelana"
        >
          <td className={cn(TD, "pl-7 text-[12.5px] sm:pl-14")}>
            <span className="font-rediseno-mono">{d.folio ?? "sin folio"}</span> ·{" "}
            <span className="text-rediseno-tinta">{d.contraparte ?? "sin contraparte"}</span>
          </td>
          {months.map((m, j) => (
            <td
              key={m}
              className={cn(TD, MONTO, "text-[12.5px]", j !== ultimo && "hidden sm:table-cell")}
            >
              {m === periodo ? formatClpBare(d.monto) : ""}
            </td>
          ))}
          <td className={cn(TD, MONTO, "text-[12.5px] text-rediseno-tinta-3-light")}>
            {d.origen ?? "—"}
          </td>
        </tr>
      ))}
      {/* N=0 es inalcanzable acá: `resuelto.documentos.length === 0` ya retornó arriba con su
          propio copy ("esta cuenta no tiene documentos"), antes de llegar a este bloque. */}
      <tr className="border-b border-rediseno-hairline-row-2 bg-rediseno-porcelana">
        <td colSpan={colSpan} className={cn(TD, "text-[12.5px] text-rediseno-tinta-3")}>
          {resuelto.descuadra ? (
            <span className={rojo ? "font-bold text-rediseno-rojo" : "font-bold"}>
              {concordar(
                resuelto.documentos.length,
                "El documento listado suma",
                `Los ${resuelto.documentos.length} documentos listados suman`,
              )}{" "}
              {formatClp(resuelto.totalSumado)}, pero la cuenta declara{" "}
              {formatClp(resuelto.totalDeclarado)}: falta detalle, no confíes en esta lista como
              completa.
            </span>
          ) : (
            <>
              {formatCount(resuelto.count)} {concordar(resuelto.count, "documento", "documentos")} ·{" "}
              {concordar(resuelto.count, "suma", "suman")} {formatClp(resuelto.totalSumado)},
              exactamente el monto de la celda.
            </>
          )}
        </td>
      </tr>
    </>
  );
}

/* ────────────────────────── Sección: Costos y gastos ────────────────────────── */

function SeccionCostos({
  filas,
  periodo,
  issueSucesor,
}: {
  filas: FilaPivote[];
  periodo: string | null;
  issueSucesor?: string;
}) {
  const lineas = React.useMemo(
    () => (periodo ? costosDelMes(filas, periodo) : []),
    [filas, periodo],
  );
  const conf = confianzaDato(lineas);
  const total = lineas.reduce((s, l) => s + l.monto, 0);

  const columnas: ColumnDef<LineaCosto, unknown>[] = React.useMemo(
    () => [
      {
        id: "cuenta",
        header: "Cuenta",
        accessorFn: (l) => l.label,
        meta: { principal: true },
        /* El `sub` va CORTO a propósito. `TablePrimaryCell` lo pinta con `truncate`, que incluye
           `white-space: nowrap`, y en una celda de tabla sin ancho máximo eso empuja la columna
           hasta el largo completo de la frase: medido en Chromium en viewport angosto, la frase que
           estaba acá llevaba esta tabla a 438 px de ancho dentro de una ventana de 360. La
           explicación completa vive en la prosa de abajo, donde sí puede envolver. */
        cell: ({ row }) => (
          <TablePrimaryCell
            value={row.original.label}
            sub={row.original.sinClasificar ? "sin clasificar" : undefined}
          />
        ),
      },
      {
        id: "monto",
        header: periodo ? columnaMes(periodo) : "Monto",
        accessorFn: (l) => l.monto,
        meta: { align: "right" },
        cell: ({ row }) => `−${formatClp(row.original.monto).replace("−", "")}`,
      },
      {
        id: "pct",
        header: "% ingresos",
        accessorFn: (l) => l.pctIngresos ?? -1,
        meta: { align: "right", hideBelow: "sm" },
        cell: ({ row }) =>
          row.original.pctIngresos == null ? (
            <span className="text-rediseno-tinta-3-light">s/d</span>
          ) : (
            formatPct(row.original.pctIngresos)
          ),
      },
    ],
    [periodo],
  );

  return (
    <section id="costos" className="space-y-3 scroll-mt-24">
      <h2 className={EYEBROW}>Costos y gastos · ¿en qué se va la plata?</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Total del mes"
          value={formatClp(total)}
          detail={periodo ? formatPeriodLabel(periodo) : "sin período"}
        />
        <KpiCard
          label="Cuentas con movimiento"
          value={String(lineas.length)}
          detail="de mayor a menor"
        />
        <KpiCard
          label="Confianza del dato"
          value={capitalizar(conf.nivel)}
          detail={
            conf.montoSinClasificar > 0
              ? `${formatClp(conf.montoSinClasificar)} aún sin clasificar`
              : "todo el costo del mes está clasificado"
          }
        />
      </div>
      {lineas.length === 0 ? (
        <DataState
          status="empty"
          what="costos ni gastos en el mes"
          hint="Cuando lleguen tus compras del período, aparecen acá cuenta por cuenta."
        />
      ) : (
        <RedisenoTable
          columns={columnas}
          data={lineas}
          pageSize={12}
          onExport={() =>
            descargarCsv(`gestion-costos-${periodo ?? "mes"}.csv`, csvCostos(lineas, periodo ?? ""))
          }
        />
      )}
      {conf.montoSinClasificar > 0 && (
        <p className="text-[12.5px] text-rediseno-tinta-3">
          Las cuentas marcadas <b>sin clasificar</b> bajan la confianza del dato: la plata salió
          igual, pero todavía no sabemos a qué categoría va. Se resuelven en la bandeja.
        </p>
      )}
      <p className="text-[12.5px] text-rediseno-tinta-3">
        Cada cuenta se abre hasta el documento desde el cuadro de arriba (clic en el monto del mes).
        El export nativo a xls todavía no existe en el backend
        {issueSucesor ? ` (${issueSucesor})` : ""}: lo que baja acá es CSV, exacto sobre lo que ves.
      </p>
    </section>
  );
}

/* ────────────────────────── Tab Márgenes (+ Ciclo + Equilibrio) ────────────────────────── */

function TabMargenes({ mes, ciclo, breakdown, motivos, onReintentar }: GestionV08ViewProps) {
  const kpis = kpisMargen(mes);
  const ciclos = kpisCiclo(ciclo);
  const eq = equilibrioResumen(breakdown);

  return (
    <Panel tab="margenes">
      {kpis ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {kpis.map((k) => (
            <KpiCard
              key={k.label}
              label={k.label}
              tone={k.tono}
              value={
                k.monto == null
                  ? "s/d"
                  : `${formatClp(k.monto)}${k.pct != null ? ` · ${formatPct(k.pct)}` : ""}`
              }
              detail={k.detalle}
            />
          ))}
        </div>
      ) : (
        <DataState
          status="error"
          what="tus márgenes del mes"
          cause={
            motivos?.resultado ??
            "El resultado del mes no llegó. Vuelve a intentar en un momento; si sigue igual, revisa tus conexiones."
          }
          action={onReintentar ? { label: "Reintentar", onClick: onReintentar } : undefined}
        />
      )}

      <section id="ciclo" className="space-y-3 scroll-mt-24">
        <h2 className={EYEBROW}>Ciclo de caja · ¿por qué ganas pero no tienes plata?</h2>
        {ciclos ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {ciclos.map((k) => (
                <KpiCard
                  key={k.label}
                  label={k.label}
                  {...(k.dias == null
                    ? { sinDato: { reason: k.motivo ?? "todavía no se puede calcular" } }
                    : { value: formatDays(k.dias) })}
                  /* El motivo del "no sé" se muestra SIEMPRE, no sólo dentro del popover del ⓘ:
                     un "sin dato" mudo obliga al usuario a hacer clic para saber qué falta. */
                  detail={k.dias == null ? (k.motivo ?? k.detalle) : k.detalle}
                />
              ))}
            </div>
            <Banner>
              {ciclos[0]?.dias != null ? (
                <>
                  <b>Cobras en {formatDays(ciclos[0].dias)}.</b> El ciclo completo necesita además
                  cuánto tardas en pagar — y ese lado todavía no se mide con precisión: el dato de
                  hoy compara universos distintos (por eso no lo publicamos como si fuera
                  comparable).
                </>
              ) : (
                <>
                  <b>Todavía no podemos medir tu ciclo de caja.</b> Necesitamos ventas cobradas y
                  compras pagadas suficientes para calcular los días; cuando lleguen, aparece acá.
                </>
              )}
            </Banner>
          </>
        ) : (
          <DataState
            status="error"
            what="tu ciclo de caja"
            cause={
              motivos?.ciclo ??
              "El cálculo del ciclo no respondió. Vuelve a intentar en un momento."
            }
          />
        )}
      </section>

      <section id="equilibrio" className="space-y-3 scroll-mt-24">
        <h2 className={EYEBROW}>
          Punto de equilibrio · ¿cuánto necesitas vender al mes para no perder?
        </h2>
        {eq ? (
          <>
            <Banner variant={eq.cubierto ? "ok" : "warn"}>
              <b>
                Si gastas como en {formatPeriodLabel(eq.mes)}, necesitas vender{" "}
                {formatClp(eq.pisoDeVenta)} al mes.
              </b>{" "}
              Ese mes vendiste {formatClp(eq.ingresoMes)}:{" "}
              {eq.cubierto
                ? `cubriste el piso con ${formatClp(eq.holgura)} de holgura`
                : `te faltaron ${formatClp(Math.abs(eq.holgura))}`}
              .
            </Banner>
            <p className="text-[12.5px] text-rediseno-tinta-3">
              El piso es empírico — lo que gastaste el último mes CERRADO —, no una proyección ni un
              margen invertido. El mes en curso no se usa: está a medio llegar.
            </p>
          </>
        ) : (
          <DataState
            status="empty"
            what="meses cerrados suficientes para calcular tu punto de equilibrio"
            hint="Necesitamos al menos un mes completo de gastos. Con el mes en curso no alcanza: está a medio llegar."
          />
        )}
      </section>
    </Panel>
  );
}

/* ────────────────────────── Tab Tendencia ────────────────────────── */

function TabTendencia({ breakdownLargo, motivos, onReintentar }: GestionV08ViewProps) {
  const t = tendencia(breakdownLargo);
  if (!t) {
    return (
      <Panel tab="tendencia">
        <DataState
          status="error"
          what="la serie de tus márgenes"
          cause={
            motivos?.resultado ??
            "El motor de gestión no respondió para el rango. Vuelve a intentar en un momento."
          }
          action={onReintentar ? { label: "Reintentar", onClick: onReintentar } : undefined}
        />
      </Panel>
    );
  }

  const maxAbs = Math.max(...t.puntos.map((p) => Math.abs(p.margenPct ?? 0)), 1);

  return (
    <Panel tab="tendencia">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Mejor mes"
          tone="ok"
          {...(t.mejor
            ? {
                value: `${columnaMes(t.mejor.periodo)} · ${formatPct(t.mejor.margenPct ?? 0)}`,
              }
            : { sinDato: { reason: "todavía no hay meses cerrados en el rango" } })}
        />
        <KpiCard
          label="Peor mes"
          {...(t.peor
            ? { value: `${columnaMes(t.peor.periodo)} · ${formatPct(t.peor.margenPct ?? 0)}` }
            : { sinDato: { reason: "todavía no hay meses cerrados en el rango" } })}
        />
        <KpiCard
          label="Promedio del período"
          {...(t.promedioPct != null
            ? { value: formatPct(t.promedioPct) }
            : { sinDato: { reason: "sin meses cerrados no hay promedio" } })}
          detail="sólo meses cerrados"
        />
      </div>

      <div className="rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie p-4">
        <ul className="flex items-end gap-1.5 sm:gap-3">
          {t.puntos.map((p) => {
            const pct = p.margenPct ?? 0;
            const alto = Math.max(6, (Math.abs(pct) / maxAbs) * 100);
            return (
              <li key={p.periodo} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className="font-rediseno-mono text-[10px] text-rediseno-tinta-3-light">
                  {p.margenPct == null ? "s/d" : formatPct(pct)}
                </span>
                <span
                  aria-hidden
                  style={{ height: `${alto}px` }}
                  className={cn(
                    "w-full rounded-t-[3px]",
                    p.proforma
                      ? "bg-rediseno-neutro-bg"
                      : pct < 0
                        ? "bg-[#D8B9B5]"
                        : "bg-rediseno-tinta",
                  )}
                />
                <span className="font-rediseno-mono text-[10px] text-rediseno-tinta-3-light">
                  {columnaMes(p.periodo)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-[12.5px] text-rediseno-tinta-3">
        El margen de cada mes es su resultado dividido por su ingreso. El mes en curso se dibuja en
        gris y NO compite por mejor ni peor mes: medio mes contra meses enteros no es una
        comparación.
      </p>
    </Panel>
  );
}

/* ────────────────────────── Tab Comparativo ────────────────────────── */

function TabComparativo({
  alDia,
  alDiaPrevioCompleto,
  motivos,
  onReintentar,
}: GestionV08ViewProps) {
  const c = comparativoAlDia(alDia, alDiaPrevioCompleto);
  if (!c) {
    return (
      <Panel tab="comparativo">
        <DataState
          status="error"
          what="la comparación con el mes anterior"
          cause={
            motivos?.comparativo ??
            "El corte al día del mes no llegó. No lo simulamos recortando una serie mensual: sería un número que ningún endpoint puede reproducir."
          }
          action={onReintentar ? { label: "Reintentar", onClick: onReintentar } : undefined}
        />
      </Panel>
    );
  }

  return (
    <Panel tab="comparativo">
      <Banner variant="warn">
        <b>
          {capitalizar(formatPeriodLabel(c.periodo))} va en curso (día {c.hastaDia}):
        </b>{" "}
        se compara contra {formatPeriodLabel(c.periodoAnterior)} a la misma altura del mes, nunca
        contra el mes completo.
      </Banner>

      <div className="overflow-hidden rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie">
        <table className="w-full text-[13px] sm:text-[13.5px]">
          <caption className="sr-only">
            Comparativo del mes en curso contra el mes anterior a la misma altura.
          </caption>
          <thead className="bg-[#FAFBFD]">
            <tr className="border-b border-rediseno-hairline">
              <th scope="col" className={TH}>
                Concepto
              </th>
              <th scope="col" className={cn(TH, "text-right")}>
                {columnaMes(c.periodo)} · al día {c.hastaDia}
              </th>
              {/* Ley 7 — en viewport angosto esta columna se colapsa y su número reaparece BAJO el concepto
                  (ver la fila): el dato no se pierde ni se abrevia, cambia de sitio. Medido en
                  Chromium sobre Linux, que es donde el ancho de la fuente aprieta de verdad: con
                  las cuatro columnas en línea la tabla se salía de la ventana. */}
              <th scope="col" className={cn(TH, "hidden text-right sm:table-cell")}>
                {columnaMes(c.periodoAnterior)} · al día {c.hastaDia}
              </th>
              {/* La referencia gris es lo PRIMERO que se colapsa en angosto: no es la comparación. */}
              <th scope="col" className={cn(TH, "hidden text-right sm:table-cell")}>
                {columnaMes(c.periodoAnterior)} completo
              </th>
              <th scope="col" className={cn(TH, "text-right")}>
                vs. misma altura
              </th>
            </tr>
          </thead>
          <tbody>
            {c.filas.map((f) => (
              <tr key={f.key} className="border-b border-rediseno-hairline-row-2 last:border-b-0">
                <td className={cn(TD, "font-semibold text-rediseno-tinta")}>
                  {f.label}
                  {/* El gemelo angosto de la columna colapsada: mismo número, mismo apellido. */}
                  <span className="mt-0.5 block font-normal text-[11.5px] text-rediseno-tinta-3-light tabular-nums sm:hidden">
                    {columnaMes(c.periodoAnterior)} · al día {c.hastaDia}:{" "}
                    {f.anteriorMismaAltura == null ? "s/d" : formatClp(f.anteriorMismaAltura)}
                  </span>
                </td>
                <td className={cn(TD, MONTO)}>{f.actual == null ? "s/d" : formatClp(f.actual)}</td>
                <td className={cn(TD, MONTO, "hidden sm:table-cell")}>
                  {f.anteriorMismaAltura == null ? "s/d" : formatClp(f.anteriorMismaAltura)}
                </td>
                <td className={cn(TD, MONTO, "hidden text-rediseno-tinta-3-light sm:table-cell")}>
                  {f.anteriorCompleto == null ? "—" : formatClp(f.anteriorCompleto)}
                </td>
                <td
                  className={cn(
                    TD,
                    MONTO,
                    f.deltaPct != null && f.deltaPct >= 0
                      ? "text-rediseno-verde"
                      : "text-rediseno-tinta",
                  )}
                >
                  {f.deltaPct == null ? "—" : formatPct(f.deltaPct, { signed: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center gap-x-2 border-t border-rediseno-hairline-row px-3 py-[11px] text-[12.5px] text-rediseno-tinta-3-light sm:px-[18px]">
          <button
            type="button"
            className={LINK}
            onClick={() => descargarCsv("gestion-comparativo.csv", csvComparativo(c))}
          >
            ⬇ Exportar CSV
          </button>
          <span>
            · flujo del registro de compras y ventas, sin nómina ni honorarios (no devengan por día)
            {c.faltaReferencia &&
              " · el mes anterior completo no llegó, así que esa columna no se muestra"}
          </span>
        </div>
      </div>
    </Panel>
  );
}

/* ────────────────────────── Tabs 360 ────────────────────────── */

function Tab360(props: GestionV08ViewProps) {
  const { tab, docs360, docs360Cargando, motivos, hoy = new Date() } = props;
  const esCliente = tab === "clientes";
  const sustantivo = esCliente ? "cliente" : "proveedor";
  const plural = esCliente ? "clientes" : "proveedores";
  const flujo = esCliente ? "ventas" : "compras";

  const [consulta, setConsulta] = React.useState("");
  const [rutSel, setRutSel] = React.useState<string | null>(null);
  // Reset de la selección al cambiar de tab: el RUT de un proveedor no existe en clientes.
  React.useEffect(() => {
    setRutSel(null);
    setConsulta("");
  }, [tab]);

  const hasta = React.useMemo(() => currentPeriodSantiago(hoy), [hoy]);
  const lista = React.useMemo(() => lista360(docs360 ?? [], hasta), [docs360, hasta]);
  const visibles = React.useMemo(
    () => filtrar360(lista.agregados, consulta),
    [lista.agregados, consulta],
  );
  const rut = rutSel ?? visibles[0]?.rut ?? null;
  const perfil = React.useMemo(
    () =>
      rut && docs360
        ? perfil360(docs360, rut, lista.desde12, lista.hasta, lista.totalGlobal)
        : null,
    [docs360, rut, lista],
  );

  if (docs360Cargando && (docs360?.length ?? 0) === 0) {
    return (
      <Panel tab={tab}>
        <p className="text-sm text-rediseno-tinta-3" aria-busy="true" aria-live="polite">
          Estamos trayendo tus {flujo} de los últimos 12 meses, mes por mes (~15 s).
        </p>
        <div className="h-40 animate-pulse rounded-[14px] bg-rediseno-neutro-bg" aria-hidden />
      </Panel>
    );
  }

  if (!docs360) {
    return (
      <Panel tab={tab}>
        <DataState
          status="error"
          what={`tus ${flujo} de los últimos 12 meses`}
          cause={
            motivos?.contrapartes ??
            "El registro de compras y ventas no respondió. Vuelve a intentar en un momento; si sigue igual, revisa tus conexiones."
          }
          action={
            props.onReintentar ? { label: "Reintentar", onClick: props.onReintentar } : undefined
          }
        />
      </Panel>
    );
  }

  if (lista.agregados.length === 0) {
    return (
      <Panel tab={tab}>
        <DataState
          status="empty"
          what={`${flujo} en los últimos 12 meses`}
          hint={`Cuando lleguen tus documentos, cada ${sustantivo} aparece acá con su volumen, su concentración y sus últimos documentos.`}
        />
      </Panel>
    );
  }

  /* Concordancia de la frase "sin resultados" (los dos incidentes reales: proveedores/clientes con
     N=1). `lista.agregados.length` nunca es 0 en este punto — el early-return de arriba ya se hizo
     cargo de la cartera vacía —, así que sólo hay singular/plural que resolver, no un caso "cero". */
  const fraseTodosSiguenAhi = concordar(
    lista.agregados.length,
    `El ${sustantivo} de los últimos 12 meses sigue ahí`,
    `Los ${lista.agregados.length} ${plural} de los últimos 12 meses siguen ahí`,
  );
  const verboVer = concordar(lista.agregados.length, "verlo", "verlos");

  return (
    <Panel tab={tab}>
      <label className="flex max-w-md items-center gap-2 rounded-full border border-rediseno-hairline bg-rediseno-superficie px-3.5 py-2">
        <Search className="size-4 shrink-0 text-rediseno-tinta-3-light" aria-hidden />
        <span className="sr-only">Buscar {sustantivo} por nombre o RUT</span>
        <input
          type="search"
          value={consulta}
          onChange={(e) => {
            setConsulta(e.target.value);
            setRutSel(null);
          }}
          placeholder={`Buscar ${sustantivo} por nombre o RUT`}
          className="min-w-0 flex-1 bg-transparent text-[13.5px] text-rediseno-tinta outline-none"
        />
      </label>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Elegir ${sustantivo}`}>
        {visibles.slice(0, 8).map((c) => (
          <button
            key={c.rut}
            type="button"
            aria-pressed={c.rut === rut}
            onClick={() => setRutSel(c.rut)}
            className={cn(
              "rounded-full border border-rediseno-hairline bg-rediseno-superficie px-[13px] py-[7px] text-xs font-semibold text-rediseno-tinta-2",
              "focus-visible:ring-2 focus-visible:ring-rediseno-azul focus-visible:outline-none",
              c.rut === rut && "border-rediseno-tinta bg-rediseno-tinta text-white",
            )}
          >
            {c.name} · {c.docs}
          </button>
        ))}
        {/* N=0 es inalcanzable acá: `lista.agregados.length === 0` ya retornó arriba con su
            propio DataState ("cuando lleguen tus documentos..."), antes de que exista buscador. */}
        {visibles.length === 0 && (
          <p className="text-[13px] text-rediseno-tinta-3">
            Ningún {sustantivo} coincide con “{consulta}”. {fraseTodosSiguenAhi}: borra la búsqueda
            para {verboVer}.
          </p>
        )}
      </div>

      {perfil && (
        <>
          <h2 className="font-rediseno-serif text-[22px] font-medium text-rediseno-tinta">
            {perfil.nombre}
          </h2>
          <p className={CRUMB}>
            {perfil.rut} · activo desde {formatPeriodLabel(perfil.activoDesde)}
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label={`${esCliente ? "Ventas" : "Compras"} · 12 meses`}
              value={formatClp(perfil.volumen12m)}
              detail="neto de notas de crédito"
            />
            <KpiCard
              label={`% de tus ${flujo}`}
              tone={perfil.alerta ? "bad" : "default"}
              {...(perfil.concentracionPct == null
                ? { sinDato: { reason: `todavía no hay ${flujo} suficientes para el total` } }
                : { value: formatPct(perfil.concentracionPct) })}
              detail={
                perfil.alerta
                  ? `concentración alta · sobre el ${formatPct(UMBRAL_CONCENTRACION_PCT)}`
                  : `bajo el umbral de alerta (${formatPct(UMBRAL_CONCENTRACION_PCT)})`
              }
            />
            <KpiCard
              label="Documentos"
              value={String(perfil.documentos)}
              detail={
                perfil.mayorDocumento != null
                  ? `mayor: ${formatClp(perfil.mayorDocumento)}`
                  : "sin documentos con monto"
              }
            />
            <KpiCard
              label="Última actividad"
              value={formatPeriodLabel(perfil.ultimaActividad)}
              detail={
                perfil.mejorMes != null
                  ? `su mejor mes suele ser ${MESES_CORTOS[perfil.mejorMes - 1]}`
                  : "sin estacionalidad medible todavía"
              }
            />
          </div>

          {perfil.alerta && (
            <Banner variant="warn">
              <b>
                Dependes mucho de esta contraparte ({formatPct(perfil.concentracionPct ?? 0)} de tus{" "}
                {flujo}).
              </b>{" "}
              {perfil.mejorMes != null
                ? `Su mejor mes es ${MESES_CORTOS[perfil.mejorMes - 1]} — concentra ahí tu negociación.`
                : "Vale la pena tener una alternativa."}
            </Banner>
          )}

          <section className="space-y-1">
            <h3 className="flex flex-wrap items-center gap-2">
              <span className={EYEBROW}>Días promedio en {esCliente ? "pagarte" : "pagar"}</span>
              <Pill variant="mut">en preparación</Pill>
            </h3>
            <p className="text-[12.5px] leading-relaxed text-rediseno-tinta-3">
              El comportamiento de pago REAL (cuánto tarda de verdad, no el plazo pactado) necesita
              cruzar cada factura con su pago en el banco. Todavía no lo tenemos, así que no lo
              estimamos: cuando esté, aparece acá con su tendencia.
            </p>
          </section>

          <TablaDocs360 docs={perfil.ultimos} nombre={perfil.nombre} />
        </>
      )}
    </Panel>
  );
}

function TablaDocs360({ docs, nombre }: { docs: DocContraparte[]; nombre: string }) {
  const columnas: ColumnDef<DocContraparte, unknown>[] = React.useMemo(
    () => [
      {
        id: "doc",
        header: "Documento",
        accessorFn: (d) => d.folio ?? "",
        meta: { principal: true },
        cell: ({ row }) => (
          <TablePrimaryCell
            value={<span className="font-rediseno-mono">{row.original.folio ?? "sin folio"}</span>}
            sub={row.original.tipo}
          />
        ),
      },
      {
        id: "fecha",
        header: "Fecha",
        accessorFn: (d) => parseSiiDate(d.fecha)?.getTime() ?? 0,
        meta: { hideBelow: "sm" },
        cell: ({ row }) => formatDateLong(parseSiiDate(row.original.fecha)),
      },
      {
        id: "tipo",
        header: "Tipo",
        accessorFn: (d) => d.tipo,
        meta: { hideBelow: "md" },
        cell: ({ row }) => (
          <Pill variant={row.original.notaCredito ? "mut" : "blue"}>{row.original.tipo}</Pill>
        ),
      },
      {
        id: "monto",
        header: "Monto",
        accessorFn: (d) => d.monto,
        meta: { align: "right" },
        cell: ({ row }) => formatClp(row.original.monto),
      },
    ],
    [],
  );

  return (
    <section className="space-y-2">
      <h3 className={EYEBROW}>Últimos documentos</h3>
      <RedisenoTable
        columns={columnas}
        data={docs}
        pageSize={12}
        emptyMessage="Sin documentos en los últimos 12 meses."
        onExport={() => descargarCsv(`360-${nombre}.csv`, csv360(docs))}
      />
      <p className="text-[12.5px] text-rediseno-tinta-3">
        Suman {formatClp(docs.reduce((s, d) => s + d.monto, 0))} · las notas de crédito restan.
      </p>
    </section>
  );
}

/** Exportar (§5.5): descarga el CSV en el navegador. Sólo corre en cliente. */
function descargarCsv(nombre: string, contenido: string) {
  if (typeof document === "undefined") return;
  const blob = new Blob([`﻿${contenido}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
