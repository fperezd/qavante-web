"use client";

import * as React from "react";
import { DocumentActionButton } from "@/components/documents/document-actions";
import { downloadXlsx } from "@/lib/export/xlsx";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertCircle,
  CalendarClock,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Search,
} from "lucide-react";
import { InicioApiPendienteButton } from "@/components/inicio/resumen/inicio-api-pendiente-button";
import { isLocalDevAppEnv } from "@/lib/app-env";
import { cn } from "@/lib/utils";
import { formatDateLike } from "@/lib/formatters/date";
import { parseAmountOrNull } from "@/lib/formatters/amount";
import { OBLIGACIONES_FINANCIERAS } from "@/lib/nav-labels";
import type {
  D02AccountsPayableResponse as AccountsPayableResponse,
  PayableDuplicatePair,
} from "@/lib/api/pagos";
import { formatClp, formatMoney } from "@/lib/formatters/clp";
import { MONTO_EN_REVISION, MONTO_EN_REVISION_MOTIVO } from "@/lib/formatters/amount";
import { Banner } from "@/components/rediseno/banner";
import { DataState } from "@/components/rediseno/data-state";
import { FilterChips } from "@/components/rediseno/filter-chip";
import { Pill } from "@/components/rediseno/pill";
import { RedisenoTable, TablePrimaryCell } from "@/components/rediseno/table";
import { esConfirmada } from "@/components/rediseno/certeza-vencimiento";
import {
  FILTROS_SERVIDOR_V05,
  PAGAR_HORIZONTES,
  TIPO_LABEL,
  TOPE_ITEMS,
  conteosServidor,
  csvPagosTable,
  dueTramoTotalFromPagos,
  elUnicoRojo,
  faltantes,
  limiteHorizontePagar,
  pagadoMetric,
  pagoEnHorizonteCompromiso,
  pagosV05,
  proximoPagoDesdePagos,
  recuadroPorPagar,
  recuadroVencidoPagar,
  nombreExportPagina,
  totales,
  type FiltroServidorV05,
  type PagoV05,
  type PagarHorizonte,
  type RecuadroPagar,
  type RojoV05,
} from "./pagar-v05-model";

/* V05 · Pagar — "¿a quién le pago, y qué es crítico?" (rediseño Fase 2, issue #70).
 *
 * PRESENTACIONAL: entra la respuesta de `accounts-payable`, sale una pantalla. La vista no
 * consulta nada — el cableado vive en `pagar-v05-live.tsx`. Así se renderea entera en un test
 * (`react-dom/server`) y en una story sin MSW. El único estado propio es de UI: período de la
 * tarjeta "Por pagar", el filtro y la búsqueda (que se delegan al servidor cuando el contenedor
 * los controla) y el interruptor de "en seguimiento", que sólo oculta filas de ESTA página.
 *
 * LEY 1 — "Por pagar · 14 días" es `due_14d` del contrato tal cual: el MISMO número que
 * "Sale · 14 días" en V02 · Caja. La vista no recalcula esos tramos desde la tabla
 * (`items` está topeado y las monedas sin TC no suman).
 *
 * LEY 2 — máximo UN rojo por pantalla, decidido en el modelo (`elUnicoRojo`): la pill "Revisar"
 * del posible duplicado más urgente que publicó el backend; si no, el relativo de la fila crítica más
 * urgente. El KPI "Vencido" NO va en rojo (el HTML de referencia lo pinta rojo; la spec manda en
 * lógica). Lo demás es ámbar o gris. Las stories y el test CUENTAN `rediseno-rojo` + `danger-`.
 *
 * LEY 9 — NO existe "pagar todo" ni "postergar": el texto fijo de la ley va literal bajo la
 * tabla. Tampoco publica un monto negociable sin un agregado global autoritativo del API.
 *
 * "NO SÉ" explícito — una fila sin fecha parseable dice "sin fecha" (nunca "vence hoy" ni 0
 * días); los documentos sin vencimiento que el backend deja fuera de la tabla (`undated_*`) se
 * declaran con monto y conteo; caja final, críticos y cobertura se presentan por separado.
 *
 * CERTEZA DE LA FECHA — server-owned. Una fila `estimated` o `unconfirmed` lleva la pill gris
 * con su etiqueta y la `due_date_note` tal cual (en el `.sub` y en "detalle ▾"); su relativo va
 * en tinta, nunca en ámbar ni en rojo, porque el modelo no la cuenta como vencida ni crítica. Una
 * fila SIN el campo lleva "Certeza no informada": no se asume confirmada. `estimated_due_date_count`
 * se publica en la tarjeta "Por pagar" como conteo del servidor, fuera de los tramos. */

export interface PagarV05ViewProps {
  deferredIds?: readonly string[];
  /** `GET /api/treasury/accounts-payable`. `null` = no llegó. */
  pagos: AccountsPayableResponse | null;
  /** Por qué no llegó, en lenguaje de dueño (cuando `pagos` es null). */
  pagosMotivo?: string | null;
  /** Pares UUID de `/anomalies`. `null` = no llegó la señal: no se concluye que no haya duplicados. */
  anomalias?: ReadonlyArray<PayableDuplicatePair> | null;
  anomaliasMotivo?: string | null;
  onReintentar?: () => void;
  /** Compatibilidad de stories antiguas; nunca se presenta al usuario. */
  issueSucesor?: string;
  /** Referencia de "hoy". Explícita para tests y stories deterministas. */
  hoy?: Date;
  filtro?: FiltroServidorV05;
  consulta?: string;
  pagina?: number;
  cursorAviso?: string | null;
  cargandoPagina?: boolean;
  horizonte?: PagarHorizonte;
  onHorizonteChange?: (horizonte: PagarHorizonte) => void;
  onFiltroChange?: (filtro: FiltroServidorV05) => void;
  onConsultaChange?: (consulta: string) => void;
  onAnterior?: () => void;
  onSiguiente?: () => void;
  /** D03: sustituye la caja final/cobertura legacy de Accounts Payable. */
  canonicalProjection?: React.ReactNode;
  /** El brief canónico ya resolvió la recomendación; conserva sólo datos y navegación de detalle. */
  suppressRecommendations?: boolean;
}

const LINK =
  "font-semibold text-rediseno-azul hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul rounded";
const EYEBROW =
  "font-rediseno-mono text-[12px] font-semibold uppercase tracking-[.12em] text-rediseno-tinta-3";

export function PagarV05View({
  deferredIds = [],
  pagos: ap,
  pagosMotivo,
  anomalias = [],
  anomaliasMotivo,
  onReintentar,
  hoy = new Date(),
  filtro: filtroControlado,
  consulta: consultaControlada,
  pagina = 1,
  cursorAviso,
  cargandoPagina = false,
  horizonte: horizonteControlado,
  onHorizonteChange,
  onFiltroChange,
  onConsultaChange,
  onAnterior,
  onSiguiente,
  canonicalProjection,
  suppressRecommendations = false,
}: PagarV05ViewProps) {
  const [horizonteLocal, setHorizonteLocal] = React.useState<PagarHorizonte>(7);
  const [filtroLocal, setFiltroLocal] = React.useState<FiltroServidorV05>("todos");
  const [consultaLocal, setConsultaLocal] = React.useState("");
  const [includeFollowup, setIncludeFollowup] = React.useState(false);
  const horizonte = horizonteControlado ?? horizonteLocal;
  const setHorizonte = onHorizonteChange ?? setHorizonteLocal;
  const filtro = filtroControlado ?? filtroLocal;
  const consulta = consultaControlada ?? consultaLocal;
  const setFiltro = onFiltroChange ?? setFiltroLocal;
  const setConsulta = onConsultaChange ?? setConsultaLocal;
  const hoyIso =
    ap?.as_of ?? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(hoy);
  const limiteHorizonte = React.useMemo(
    () => limiteHorizontePagar(hoyIso, horizonte),
    [hoyIso, horizonte],
  );

  /* Con el Brief activo la tabla es EVIDENCIA: orden de la fuente y sin señales de decisión
     (criticidad y postergabilidad son heurísticas locales que el Brief ya no delega acá). */
  const filas = React.useMemo(
    () =>
      pagosV05(ap, hoy, anomalias ?? [], {
        order: suppressRecommendations ? "source" : "urgency",
        includeDecisionSignals: !suppressRecommendations,
      }),
    [ap, hoy, anomalias, suppressRecommendations],
  );
  const rojo = suppressRecommendations ? null : elUnicoRojo(filas);
  /* Los conteos de los chips los publica el servidor sobre TODO el registro: filtrar o paginar
     no puede cambiarlos (D02/D15). "En seguimiento" es sólo un ocultamiento de filas de ESTA
     página: no entra en ningún agregado. */
  const conteos = ap ? conteosServidor(ap) : null;
  const visibles = filas.filter((p) => {
    if (!includeFollowup && p.item.id && deferredIds.includes(p.item.id)) return false;
    if (filtro === "todos" && !pagoEnHorizonteCompromiso(p, limiteHorizonte)) return false;
    return true;
  });
  const tot = totales(ap, filas);
  const falta = faltantes(ap);
  const correlacionAnomaliasIncompleta =
    anomalias != null && (ap?.items ?? []).some((item) => !item.id?.trim());
  const motivoAnomaliasIncompletas =
    "Algunos pagos no tienen identificador estable; no pudimos correlacionar sus posibles duplicados.";

  /* (0) Sin respuesta: la pantalla no está vacía, está ciega — y lo dice. */
  if (!ap) {
    return (
      <DataState
        status="error"
        what="las cuentas por pagar"
        cause={
          pagosMotivo ??
          "El registro de pagos no respondió. Vuelve a intentar en un momento; si sigue igual, revisa tus conexiones."
        }
        action={
          onReintentar
            ? { label: "Reintentar", onClick: onReintentar }
            : { label: "Revisar conexiones", href: "/conexiones" }
        }
      />
    );
  }

  /* (0') Sin nada agendado ni nada sin fecha: no hay tabla que mostrar; se dice qué falta. */
  if (ap.filter_metadata.unfiltered_items_total === 0 && (ap.undated_count ?? 0) === 0) {
    return (
      <DataState
        status="empty"
        what="pagos por pagar"
        hint={
          falta
            ? `El registro aún no tiene pagos agendados. Falta: ${falta}.`
            : "El registro no tiene pagos pendientes con fecha: no hay nada agendado que pagar."
        }
        action={{ label: "Revisar conexiones", href: "/conexiones" }}
      />
    );
  }

  const dueCalculado90 =
    horizonte === 90 ? dueTramoTotalFromPagos(filas, limiteHorizonte) : undefined;
  const porPagarRecuadro = recuadroPorPagar(ap, horizonte, dueCalculado90, filas);
  const vencidoRecuadro = recuadroVencidoPagar(ap, filas);
  const pagadoRecuadro = pagadoMetric(horizonte);
  const proximoPago = proximoPagoDesdePagos(filas, limiteHorizonte);
  const sinFechasConfirmadas =
    parseAmountOrNull(ap.undated_amount) != null &&
    parseAmountOrNull(ap.total) != null &&
    parseAmountOrNull(ap.undated_amount)! >= parseAmountOrNull(ap.total)!;

  return (
    <div className="space-y-5">
      {canonicalProjection}

      <section className="grid gap-4 md:grid-cols-3" aria-label="Resumen de pagos">
        <PorPagarMetricCard
          horizonte={horizonte}
          porPagar={porPagarRecuadro}
          vencido={vencidoRecuadro}
        />
        <PagadoMetricCard {...pagadoRecuadro} />
        {isLocalDevAppEnv() && (
          <ProximoPagoMetricCard
            fecha={proximoPago}
            sinFechasConfirmadas={sinFechasConfirmadas}
            documentosParciales={ap.has_more}
          />
        )}
      </section>

      <EstadoNomina ap={ap} />

      {(anomalias == null || correlacionAnomaliasIncompleta) && (
        <Banner role="status">
          <span>
            {anomalias == null
              ? (anomaliasMotivo ?? "No tenemos la señal de posibles duplicados todavía.")
              : motivoAnomaliasIncompletas}
          </span>
          {onReintentar && (
            <button type="button" onClick={onReintentar} className={LINK}>
              Reintentar
            </button>
          )}
        </Banner>
      )}

      {cursorAviso && (
        <Banner role="status">
          <span>{cursorAviso}</span>
        </Banner>
      )}

      {/* (3) Filtros con conteo + búsqueda, (4) tabla. */}
      <section aria-labelledby="v05-pagos" className="space-y-2">
        <h2 id="v05-pagos" className={EYEBROW}>
          Pagos y obligaciones
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <label className="relative min-w-0 flex-1 basis-[16rem]">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-rediseno-tinta-3-light"
              aria-hidden
            />
            <span className="sr-only">Buscar proveedor, folio o RUT</span>
            <input
              type="search"
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              placeholder="Proveedor, folio o RUT…"
              className="w-full rounded-full border border-rediseno-hairline bg-rediseno-superficie py-[7px] pr-3 pl-9 text-xs text-rediseno-tinta placeholder:text-rediseno-tinta-3-light focus-visible:ring-2 focus-visible:ring-rediseno-azul focus-visible:outline-none"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-rediseno-tinta-3">Ver compromisos hasta</p>
            <div
              className="flex flex-wrap rounded-full border border-rediseno-hairline bg-rediseno-superficie"
              role="group"
              aria-label="Horizonte de compromisos de pago"
            >
              {PAGAR_HORIZONTES.map((days) => (
                <button
                  key={days}
                  type="button"
                  aria-pressed={horizonte === days}
                  onClick={() => setHorizonte(days)}
                  className={cn(
                    "flex min-h-9 items-center border-r border-rediseno-hairline px-2.5 text-xs font-medium text-rediseno-tinta-2 last:border-r-0 hover:bg-rediseno-neutro-bg sm:px-3",
                    horizonte === days &&
                      "bg-rediseno-azul font-semibold text-white hover:bg-rediseno-azul",
                  )}
                >
                  {days} días
                </button>
              ))}
            </div>
          </div>
          <FilterChips
            aria-label="Filtrar pagos"
            className="mt-0 mb-0"
            options={FILTROS_SERVIDOR_V05.map((f) => ({
              id: f.id,
              label: f.label,
              count: conteos?.[f.id] ?? 0,
            }))}
            value={filtro}
            onChange={setFiltro}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <DocumentActionButton kind="payable" label="Buscar documento o pago registrado" />
          {deferredIds.length > 0 && (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeFollowup}
                onChange={(e) => setIncludeFollowup(e.target.checked)}
              />
              Incluir en seguimiento ({deferredIds.length})
            </label>
          )}
        </div>
        <TablaPagos
          pagos={visibles}
          totalPagos={ap.items_total}
          rojo={rojo}
          showDecisionSignals={!suppressRecommendations}
          onExport={() =>
            descargarExcel(
              nombreExportPagina(pagina),
              csvPagosTable(visibles, { includeDecisionSignals: !suppressRecommendations }),
            )
          }
          emptyMessage={
            consulta.trim()
              ? "Ningún pago coincide con esa búsqueda."
              : "Ningún pago en este filtro."
          }
        />

        <div className="flex items-center justify-between gap-3 text-xs text-rediseno-tinta-3">
          <span>
            Página {pagina} · exporta sólo esta página
            {cargandoPagina ? " · actualizando…" : ""}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className={LINK}
              disabled={!onAnterior || cargandoPagina}
              onClick={onAnterior}
            >
              Anterior
            </button>
            <button
              type="button"
              className={LINK}
              disabled={!onSiguiente || !ap.next_cursor || cargandoPagina}
              onClick={onSiguiente}
            >
              Siguiente
            </button>
          </div>
        </div>

        {/* Footer §5.5: el total con su apellido, por moneda (INV-FX-001). */}
        <p className="text-[12.5px] text-rediseno-tinta-3">
          Total por pagar{" "}
          <span className="font-semibold tabular-nums text-rediseno-tinta">
            {tot.totalClp != null
              ? formatClp(tot.totalClp)
              : tot.enRevision
                ? MONTO_EN_REVISION.toLowerCase()
                : "sin dato"}
          </span>{" "}
          convertido a pesos
          {tot.porMoneda.length > 1 && (
            <> · por moneda: {tot.porMoneda.map((m) => `${m.label} (${m.moneda})`).join(" + ")}</>
          )}
          {tot.sinConvertir > 0 &&
            ` · ${tot.sinConvertir} ${tot.sinConvertir === 1 ? "pago" : "pagos"} en otra moneda sin tipo de cambio, fuera del total`}
          {tot.posiblementeTopeado &&
            ` · el registro lista hasta ${TOPE_ITEMS} pagos: puede haber más que no se muestran`}
          {falta && <> · falta: {falta}</>}
        </p>
      </section>
    </div>
  );
}

const PROXIMO_PAGO_API_PENDIENTE =
  "No existe un campo «próximo pago» en el API. Hoy la fecha sale del vencimiento confirmado más cercano (≥ hoy) entre los pagos fechados ya traídos con GET /api/treasury/accounts-payable. Si faltan páginas, la fecha puede cambiar al traer más pagos.\n\nPara una cifra de cartera completa sin paginar: agregar en backend un agregado MIN(due_date) sobre payables vivos con fecha confirmada, o ordenar por due_date ASC con limit=1.\n\nSin vencimientos del SII: sincronizar el XML del DTE (enriquecimiento de fechas) desde Conexiones; hasta entonces no hay próximo pago nominal confiable.";

function PorPagarMetricCard({
  horizonte,
  porPagar,
  vencido,
}: {
  horizonte: PagarHorizonte;
  porPagar: RecuadroPagar;
  vencido: RecuadroPagar;
}) {
  const label = `Por pagar · ${horizonte} días`;
  return (
    <div
      data-metric={label}
      className="relative overflow-hidden rounded-xl border border-red-100 bg-gradient-to-br from-red-50/80 via-rediseno-superficie to-rediseno-superficie p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-rediseno-tinta-2">{label}</p>
        <span className="rounded-lg bg-red-50 p-2 text-red-700">
          <Clock3 className="size-4 shrink-0" aria-hidden="true" />
        </span>
      </div>
      {porPagar.detail && <p className="mt-1 text-xs text-rediseno-tinta-3">{porPagar.detail}</p>}
      <p
        data-metric-valor=""
        className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-red-700"
      >
        {porPagar.value}
      </p>
      {porPagar.note && (
        <p className="mt-2 text-xs leading-relaxed text-rediseno-tinta-3">{porPagar.note}</p>
      )}
      <details className="group/vencido mt-4 border-t border-rediseno-hairline pt-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-rediseno-tinta [&::-webkit-details-marker]:hidden">
          <AlertCircle className="size-4 shrink-0 text-rediseno-tinta-3" aria-hidden="true" />
          Vencido
          {vencido.detail && (
            <span className="ml-auto font-normal text-rediseno-tinta-3">{vencido.detail}</span>
          )}
          <ChevronDown
            className="size-4 shrink-0 text-rediseno-tinta-3 transition-transform group-open/vencido:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </summary>
        <div className="mt-2 space-y-2">
          <p className="text-xl font-bold tabular-nums text-rediseno-tinta">{vencido.value}</p>
          {vencido.note && (
            <p className="text-xs leading-relaxed text-rediseno-tinta-3">{vencido.note}</p>
          )}
        </div>
      </details>
    </div>
  );
}

function PagadoMetricCard({ value, detail, note }: RecuadroPagar) {
  return (
    <div
      data-metric="Pagado"
      className="rounded-xl border border-rediseno-hairline bg-rediseno-superficie p-5"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-rediseno-tinta">
        <CircleDollarSign className="size-4 shrink-0" aria-hidden="true" />
        Pagado
        {detail && <span className="ml-auto font-normal text-rediseno-tinta-3">{detail}</span>}
      </div>
      <p data-metric-valor="" className="mt-3 text-2xl font-bold tabular-nums text-rediseno-tinta">
        {value}
      </p>
      {note && <p className="mt-2 text-xs leading-relaxed text-rediseno-tinta-3">{note}</p>}
    </div>
  );
}

function ProximoPagoMetricCard({
  fecha,
  sinFechasConfirmadas,
  documentosParciales,
}: {
  fecha: string | null;
  sinFechasConfirmadas: boolean;
  documentosParciales: boolean;
}) {
  const valor = fecha
    ? formatDateLike(fecha)
    : sinFechasConfirmadas
      ? "Sin fecha confirmada"
      : "Estira el horizonte";
  const nota = documentosParciales
    ? "Calculado con los pagos traídos hasta acá; trae más páginas para cerrar la fecha."
    : fecha
      ? "Vencimiento confirmado más cercano dentro del horizonte elegido."
      : undefined;
  const apiMsg = documentosParciales
    ? `${PROXIMO_PAGO_API_PENDIENTE}\n\nAhora mismo faltan páginas por traer en la lista de pagos.`
    : PROXIMO_PAGO_API_PENDIENTE;

  return (
    <div
      data-metric="Próximo pago"
      className="rounded-xl border border-rediseno-hairline bg-rediseno-superficie p-5"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-rediseno-tinta">
        <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
        Próximo pago
        <InicioApiPendienteButton mensaje={apiMsg} className="ml-1" />
      </div>
      <p data-metric-valor="" className="mt-3 text-2xl font-bold tabular-nums text-rediseno-tinta">
        {valor}
      </p>
      {nota && <p className="mt-2 text-xs leading-relaxed text-rediseno-tinta-3">{nota}</p>}
    </div>
  );
}

/* ── (4) La tabla (§1.3 `.tw > table.t`, §5.5) ───────────────────────────────── */

const HREF_LABEL: Record<string, string> = {
  "/pagar/facturas-recibidas": "Ver en Facturas recibidas",
  "/pagar/impuestos": "Ver en Impuestos",
  "/pagar/obligaciones": `Ver en ${OBLIGACIONES_FINANCIERAS}`,
};

function hrefLabelDe(p: PagoV05): string {
  if (p.href?.startsWith("/remuneraciones")) return "Ver en Remuneraciones";
  return (p.href && HREF_LABEL[p.href]) || "Ver el detalle";
}

function TablaPagos({
  pagos,
  totalPagos,
  rojo,
  onExport,
  emptyMessage,
  showDecisionSignals = true,
}: {
  pagos: PagoV05[];
  totalPagos: number;
  rojo: RojoV05;
  onExport: () => void;
  emptyMessage: string;
  /** Con el Brief activo la tabla no pinta pills de decisión: es evidencia. */
  showDecisionSignals?: boolean;
}) {
  const columns = React.useMemo<ColumnDef<PagoV05, unknown>[]>(
    () => [
      {
        id: "proveedor",
        accessorFn: (p) => p.nombre,
        header: "Proveedor",
        meta: { principal: true },
        cell: ({ row }) => <TablePrimaryCell value={row.original.nombre} sub={row.original.sub} />,
      },
      {
        id: "vence",
        /* Orden cronológico; el "sin fecha" al final, pero presente. */
        accessorFn: (p) => p.dias ?? Number.MAX_SAFE_INTEGER,
        header: "Vence",
        cell: ({ row }) => {
          const p = row.original;
          if (p.dias == null) {
            return <span className="italic text-rediseno-tinta-3-light">sin fecha</span>;
          }
          const esElRojo = rojo?.motivo === "critico" && rojo.key === p.key;
          return (
            <span className="inline-flex flex-col items-start gap-0.5">
              <span className="whitespace-nowrap">
                {p.venceLabel} ·{" "}
                <span
                  className={cn(
                    /* Ley 2: el relativo rojo es UNO — la fila crítica más urgente, y sólo cuando
                       ningún duplicado se llevó el rojo de la pantalla. Lo vencido va en ámbar.
                       Una fecha no confirmada nunca es vencida ni crítica (modelo): queda en tinta. */
                    esElRojo
                      ? "font-bold text-rediseno-rojo"
                      : p.vencido
                        ? "font-semibold text-rediseno-ambar"
                        : "text-rediseno-tinta-3",
                  )}
                >
                  {p.relativoLabel}
                </span>
              </span>
              {/* Certeza server-owned: pill gris con la etiqueta del estado; la nota va en el
                  `.sub` de la fila y en "detalle ▾", tal cual llega. Confirmada = sin pill. */}
              {!esConfirmada(p.certeza) && (
                <Pill variant="mut" title={p.notaVencimiento ?? undefined}>
                  {fechaEstadoLabel(p.certeza)}
                </Pill>
              )}
            </span>
          );
        },
      },
      /* La columna "Tipo" es una señal de DECISIÓN (negociable / no se posterga / crédito). Con el
         Brief activo la tabla es evidencia y el modelo ya no la calcula: la columna no se monta. */
      ...(showDecisionSignals
        ? [
            {
              id: "tipo",
              accessorFn: (p: PagoV05) => (p.tipo ? TIPO_LABEL[p.tipo] : ""),
              header: "Tipo",
              meta: { hideBelow: "sm" as const },
              cell: ({ row }: { row: { original: PagoV05 } }) => {
                const p = row.original;
                if (!p.tipo) return null;
                if (p.anomalia) {
                  /* Ley 2: la pill roja es UNA — el duplicado más urgente; los demás en ámbar. */
                  const esElRojo = rojo?.motivo === "anomalia" && rojo.key === p.key;
                  return <Pill variant={esElRojo ? "bad" : "warn"}>{TIPO_LABEL.revisar}</Pill>;
                }
                const variant =
                  p.tipo === "credito" ? "blue" : p.tipo === "negociable" ? "warn" : "mut";
                return <Pill variant={variant}>{TIPO_LABEL[p.tipo]}</Pill>;
              },
            },
          ]
        : []),
      {
        id: "monto",
        accessorFn: (p) => p.montoClp ?? 0,
        header: "Monto",
        meta: { align: "right" },
        cell: ({ row }) => {
          const p = row.original;
          // #907: en revisión (y cualquier fila sin cifra) nunca se pinta "$0".
          if (p.enRevision || p.moneda !== "CLP" || p.montoClp == null) return p.montoLabel;
          return formatClp(p.montoClp);
        },
      },
      {
        id: "detalle",
        header: "",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => <DetallePago pago={row.original} />,
      },
    ],
    [rojo, showDecisionSignals],
  );
  return (
    <RedisenoTable
      columns={columns}
      data={pagos}
      totalCount={totalPagos}
      pagination={false}
      onExport={onExport}
      exportLabel="Exportar esta página"
      emptyMessage={emptyMessage}
      rowKey={(pago) => pago.key}
    />
  );
}

/** "detalle ▾": los hechos del pago (documento, RUT, fuente, moneda) + el link a su módulo. */
function DetallePago({ pago: p }: { pago: PagoV05 }) {
  return (
    <details className="relative inline-block text-left">
      <summary
        className={cn(
          LINK,
          "cursor-pointer list-none whitespace-nowrap text-[12.5px] [&::-webkit-details-marker]:hidden",
        )}
      >
        detalle ▾
      </summary>
      <div className="absolute right-0 top-full z-40 mt-1.5 w-[min(20rem,80vw)] rounded-xl border border-rediseno-hairline bg-rediseno-superficie p-3 text-left text-[12.5px] font-normal leading-relaxed text-rediseno-tinta-2 shadow-lg">
        <p className="font-semibold text-rediseno-tinta">{p.nombre}</p>
        {p.item.id && <DocumentActionButton kind="payable" documentId={p.item.id} />}
        <dl className="mt-1 space-y-0.5">
          {p.documento && <Dato k="Documento" v={p.documento} />}
          {p.rutLabel && <Dato k="RUT" v={p.rutLabel} />}
          <Dato k="Fuente" v={p.fuente} />
          <Dato
            k="Vence"
            v={p.dias == null ? "sin fecha" : `${p.venceLabel} (${p.relativoLabel})`}
          />
          {/* La certeza y la nota del servidor, sin reescribir. Confirmada no necesita línea. */}
          {!esConfirmada(p.certeza) && <Dato k="Fecha" v={fechaEstadoLabel(p.certeza)} />}
          <Dato
            k="Monto"
            v={`${p.montoLabel}${p.moneda !== "CLP" && p.montoClp != null ? ` · ${formatClp(p.montoClp)} al tipo de cambio` : ""}`}
          />
          {p.enRevision && <Dato k="Estado" v={MONTO_EN_REVISION_MOTIVO} />}
          {p.sinConvertir && <Dato k="Conversión" v="sin tipo de cambio: no se suma como pesos" />}
          {p.reclamado && <Dato k="Estado SII" v="reclamada por el receptor" />}
          {p.anomalia && <Dato k="Revisar" v={p.anomalia.detalle} />}
        </dl>
        {p.href && (
          <p className="mt-2">
            <Link href={p.href} className={LINK}>
              {hrefLabelDe(p)}
            </Link>
          </p>
        )}
      </div>
    </details>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 font-rediseno-mono text-[12px] uppercase tracking-[.1em] text-rediseno-tinta-3">
        {k}
      </dt>
      <dd className="min-w-0">{v}</dd>
    </div>
  );
}

function fechaEstadoLabel(certeza: PagoV05["certeza"]): string {
  if (certeza === "estimated") return "Fecha aproximada";
  if (certeza === "unconfirmed") return "Fecha por confirmar";
  return "Sin fecha confirmada";
}

/** Exportar (§5.5): descarga Excel con celdas tipadas en el navegador. Sólo corre en cliente. */
const descargarExcel = downloadXlsx;

/**
 * Etiqueta de lo que la fuente APORTA, no de quién lo aporta.
 *
 * El banner imprimía el código crudo de la API: un CFO leía «buk: frescura no confirmada».
 * El proveedor es un detalle de integración (Buk hoy, Talana mañana, o carga manual) y el
 * usuario necesita saber QUÉ le falta: las remuneraciones o las cotizaciones. Un código que
 * no está en el mapa cae a «Nómina» en vez de filtrarse crudo a la pantalla.
 */
const CONCEPTO_NOMINA: Record<string, string> = {
  buk: "Remuneraciones",
  talana: "Remuneraciones",
  previred: "Cotizaciones previsionales",
};

function etiquetaFuenteNomina(source: string): string {
  return CONCEPTO_NOMINA[source.trim().toLowerCase()] ?? "Nómina";
}

/** Estados de `core.connection_status` que significan «nunca se configuró». */
const NOMINA_SIN_CONFIGURAR = new Set(["unconfigured", "credentials_missing"]);

/**
 * Por qué esa fuente no cubre el período.
 *
 * Antes decía siempre «frescura no confirmada», aunque el filtro es por `covered`: una fuente
 * que nunca se conectó salía como un problema de frescura, y el usuario se iba a actualizar algo
 * que no existe. Son dos acciones distintas —declarar el sistema o cargar el mes— y el mensaje
 * tiene que distinguirlas.
 */
function motivoSinCobertura(source: { status: string }): string {
  return NOMINA_SIN_CONFIGURAR.has(source.status.trim().toLowerCase())
    ? "sin sistema declarado ni carga manual"
    : "datos del período sin confirmar";
}

function EstadoNomina({ ap }: { ap: AccountsPayableResponse }) {
  const next = ap.next_payroll;
  const cobertura = ap.payroll_coverage;
  if (next) {
    const currency = next.currency?.trim().toUpperCase();
    const monedaVerificada = next.currency_status === "verified" && currency != null;
    // #907: `amount` null = en revisión de conciliación. Nunca `Number(null)` (= $0).
    const original =
      next.amount == null
        ? "monto en revisión"
        : monedaVerificada
          ? formatMoney(Number(next.amount), currency)
          : "monto con moneda sin verificar";
    const convertido =
      next.amount != null && monedaVerificada && currency !== "CLP" && next.amount_clp != null
        ? ` · ${formatClp(Number(next.amount_clp))} convertido`
        : "";
    return (
      <Banner role="status">
        <span>
          Próxima nómina: <b>{next.label}</b> · {next.due_date} · {original}
          {convertido}
          {next.is_overdue ? " · vencida" : ""}
          {!cobertura.complete ? " · cobertura de nómina incompleta" : ""}.
        </span>
      </Banner>
    );
  }
  if (cobertura.complete) {
    return (
      <Banner role="status">
        <span>No hay obligaciones vivas de nómina en el corte actual.</span>
      </Banner>
    );
  }
  const pendientes = cobertura.sources
    .filter((source) => !source.covered)
    .map((source) => `${etiquetaFuenteNomina(source.source)}: ${motivoSinCobertura(source)}`)
    .join(" · ");
  return (
    <Banner role="status">
      <span>
        Próxima nómina: no determinada; falta confirmar la carga del período
        {pendientes ? ` (${pendientes})` : ""}.
      </span>
    </Banner>
  );
}
