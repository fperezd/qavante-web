"use client";

import * as React from "react";
import { DocumentActionButton } from "@/components/documents/document-actions";
import { downloadXlsx } from "@/lib/export/xlsx";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Info, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { rovingIndex } from "@/lib/a11y/roving";
import type {
  D02AccountsPayableResponse as AccountsPayableResponse,
  PayableDuplicatePair,
} from "@/lib/api/pagos";
import { formatClp, formatMoney } from "@/lib/formatters/clp";
import { concordar, formatCount } from "@/lib/formatters/count";
import { Banner } from "@/components/rediseno/banner";
import { DataState } from "@/components/rediseno/data-state";
import { FilterChips } from "@/components/rediseno/filter-chip";
import { KpiCard } from "@/components/rediseno/kpi-card";
import { Pill } from "@/components/rediseno/pill";
import { RedisenoTable, TablePrimaryCell } from "@/components/rediseno/table";
import { CERTEZA_LABEL, esConfirmada } from "@/components/rediseno/certeza-vencimiento";
import {
  FILTROS_SERVIDOR_V05,
  LEY_9_TEXTO,
  PERIODOS,
  TIPO_LABEL,
  TOPE_ITEMS,
  VENTANA_DIAS,
  certezaLabelDe,
  conteosServidor,
  csvPagosTable,
  elUnicoRojo,
  explicacionCritico,
  explicacionPorPagar,
  explicacionVencido,
  explicacionVencidoEvidencia,
  faltantes,
  kpiCritico,
  kpiPorPagar,
  kpiVencidoGlobal,
  nombreExportPagina,
  pagosV05,
  totales,
  type ExplicacionV05,
  type FiltroServidorV05,
  type PagoV05,
  type PeriodoV05,
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
  onFiltroChange,
  onConsultaChange,
  onAnterior,
  onSiguiente,
  canonicalProjection,
  suppressRecommendations = false,
}: PagarV05ViewProps) {
  const [periodo, setPeriodo] = React.useState<PeriodoV05>(14);
  const [filtroLocal, setFiltroLocal] = React.useState<FiltroServidorV05>("todos");
  const [consultaLocal, setConsultaLocal] = React.useState("");
  const [includeFollowup, setIncludeFollowup] = React.useState(false);
  const filtro = filtroControlado ?? filtroLocal;
  const consulta = consultaControlada ?? consultaLocal;
  const setFiltro = onFiltroChange ?? setFiltroLocal;
  const setConsulta = onConsultaChange ?? setConsultaLocal;

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
  const vencido = kpiVencidoGlobal(ap);
  const porPagar = kpiPorPagar(ap, periodo);
  const critico = kpiCritico(filas, ap);
  const infoVencido = suppressRecommendations
    ? explicacionVencidoEvidencia(ap, hoy)
    : explicacionVencido(ap, hoy);
  /* Los conteos de los chips los publica el servidor sobre TODO el registro: filtrar o paginar
     no puede cambiarlos (D02/D15). "En seguimiento" es sólo un ocultamiento de filas de ESTA
     página: no entra en ningún agregado. */
  const conteos = ap ? conteosServidor(ap) : null;
  const visibles = filas.filter(
    (p) => includeFollowup || !p.item.id || !deferredIds.includes(p.item.id),
  );
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

  const coberturaTexto =
    critico.cobertura === true
      ? "Estado de cobertura del horizonte: cubre."
      : critico.cobertura === false
        ? "Estado de cobertura del horizonte: no cubre."
        : `Estado de cobertura del horizonte: indeterminado; ${critico.motivoSinCobertura}.`;
  const subtotalCriticoIncompleto = !critico.completo;
  const notaFechasDesconocidas =
    critico.fechasDesconocidas > 0
      ? ` · ${critico.fechasDesconocidas} ${critico.fechasDesconocidas === 1 ? "obligación sin fecha clasificable" : "obligaciones sin fecha clasificable"}`
      : "";
  const notaMonedasExcluidas = critico.monedasExcluidas
    ? ` · ${critico.monedasExcluidas} ${critico.monedasExcluidas === 1 ? "moneda excluida" : "monedas excluidas"} por falta de tipo de cambio; el API no publica cuántos pagos contiene`
    : "";
  const contextoCritico = subtotalCriticoIncompleto ? (
    critico.total > 0 ? (
      <>
        Pagos críticos en todo el registro: al menos {formatClp(critico.total)} · {critico.n}{" "}
        {critico.n === 1 ? "pago" : "pagos"} en {VENTANA_DIAS} días
        {critico.yaVencido > 0 && ` · al menos ${formatClp(critico.yaVencido)} ya vencido`}
        {notaFechasDesconocidas}
        {notaMonedasExcluidas}.
      </>
    ) : (
      <>
        Pagos críticos en todo el registro: subtotal no disponible
        {critico.n > 0 &&
          ` · ${critico.n} ${critico.n === 1 ? "pago" : "pagos"} en ${VENTANA_DIAS} días`}
        {notaFechasDesconocidas}
        {notaMonedasExcluidas}.
      </>
    )
  ) : (
    <>
      Pagos críticos en todo el registro: {formatClp(critico.total)} ·{" "}
      {critico.n > 0
        ? `${critico.n} ${critico.n === 1 ? "pago que no se posterga" : "pagos que no se postergan"} en ${VENTANA_DIAS} días`
        : `ningún pago crítico en todo el registro dentro de ${VENTANA_DIAS} días`}
      {critico.yaVencido > 0 && ` · ${formatClp(critico.yaVencido)} ya vencido`}.
    </>
  );
  const detalleCaja = (
    <>
      <span className="block">Saldo final del flujo vigente.</span>
      <span className="block">{contextoCritico}</span>
      <span className="block">
        Las obligaciones comprometidas ya están incluidas en el flujo proyectado; no se vuelven a
        restar.
      </span>
      <span className="block">{coberturaTexto}</span>{" "}
      <InfoPopover label="Qué significan Caja y críticos" info={explicacionCritico(ap, hoy)} />
    </>
  );

  return (
    <div className="space-y-5">
      {/* (1) Tríada: Vencido / Por pagar · período / Caja proyectada + críticos separados. */}
      <section
        aria-label="Vencido, por pagar y caja proyectada"
        className="grid gap-3 sm:grid-cols-3"
      >
        <KpiCard
          label="Vencido"
          {...(vencido.total == null
            ? { sinDato: { reason: "La cobertura de fechas o monedas está incompleta." } }
            : { value: formatClp(vencido.total) })}
          detail={
            <>
              {vencido.n > 0 ? (
                <>
                  {formatCount(vencido.n)} {concordar(vencido.n, "pago", "pagos")} en todo el
                  registro
                  {!vencido.completo && ` · al menos ${formatClp(vencido.conocido)} conocidos`}
                  {vencido.monedasExcluidas > 0 &&
                    ` · ${vencido.monedasExcluidas} monedas sin conversión`}
                  {vencido.sinFecha > 0 && ` · ${vencido.sinFecha} sin fecha clasificable`}
                </>
              ) : (
                "ningún pago vencido conocido"
              )}{" "}
              <InfoPopover label="Qué es Vencido" info={infoVencido} />
            </>
          }
        />
        {porPagar.total != null ? (
          <KpiCard
            label="Por pagar"
            period={`${periodo} días`}
            value={formatClp(porPagar.total)}
            detail={
              <>
                <span>
                  incluye lo vencido
                  {porPagar.sinFecha &&
                    ` · ${porPagar.sinFecha.n} ${porPagar.sinFecha.n === 1 ? "documento" : "documentos"} ${porPagar.sinFecha.monto == null ? "con monto no disponible" : `por ${formatClp(porPagar.sinFecha.monto)}`} sin fecha, en ningún tramo`}
                  {/* `estimated_due_date_count` del servidor: fechas estimadas que no entran en
                      los tramos. Con 0 no se dice nada; sin el campo tampoco (no se asume 0). */}
                  {porPagar.estimadas != null &&
                    porPagar.estimadas > 0 &&
                    ` · ${formatCount(porPagar.estimadas)} ${concordar(porPagar.estimadas, "pago", "pagos")} con fecha estimada, fuera de los tramos`}{" "}
                  <InfoPopover
                    label="Qué es Por pagar"
                    info={explicacionPorPagar(ap, periodo, hoy)}
                  />
                </span>
                <SelectorPeriodo periodo={periodo} onChange={setPeriodo} />
              </>
            }
          />
        ) : (
          <KpiCard
            label="Por pagar"
            period={`${periodo} días`}
            sinDato={{ reason: "La fuente no informó este tramo." }}
            detail={<SelectorPeriodo periodo={periodo} onChange={setPeriodo} />}
          />
        )}
        {!canonicalProjection &&
          (critico.cajaFinal != null ? (
            <KpiCard
              label="Caja proyectada"
              period={`${VENTANA_DIAS} días`}
              value={formatMoney(critico.cajaFinal, critico.monedaCaja)}
              detail={detalleCaja}
            />
          ) : (
            <KpiCard
              label="Caja proyectada"
              period={`${VENTANA_DIAS} días`}
              sinDato={{ reason: critico.motivoSinCaja ?? "El saldo proyectado no llegó." }}
              detail={detalleCaja}
            />
          ))}
      </section>

      {canonicalProjection}

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
        {suppressRecommendations && (
          <p className="text-[12.5px] text-rediseno-tinta-3">
            Los pagos se muestran en el orden publicado por la fuente.
          </p>
        )}
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
            {tot.totalClp != null ? formatClp(tot.totalClp) : "sin dato"}
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

        {/* Ley 9 (texto fijo, literal) + huecos declarados. Con Brief activo el pie sólo describe
            la evidencia: la política de postergación no se reproduce por una segunda vía. */}
        {suppressRecommendations ? (
          <p className="text-[12px] leading-relaxed text-rediseno-tinta-3">
            Cada fila abre el respaldo del pago. Una alerta de posible duplicado indica que el
            registro señaló dos documentos para revisar; no elimina ni modifica obligaciones. La
            fuente todavía no distingue servicios recurrentes de otras facturas.
          </p>
        ) : (
          <p className="text-[12px] leading-relaxed text-rediseno-tinta-3">
            <b className="font-semibold text-rediseno-tinta-2">
              No existe un botón “pagar todo”, y postergar no es una acción aquí:
            </b>{" "}
            mover plata siempre lleva firma humana. {LEY_9_TEXTO} Cada fila abre el respaldo del
            pago. Una alerta de posible duplicado indica que debes revisar ambos registros antes de
            pagar; no elimina ni modifica obligaciones. La fuente todavía no distingue servicios
            recurrentes de otras facturas.
          </p>
        )}
      </section>
    </div>
  );
}

/* ── Selector de período (los tres tramos que publica el backend) ────────────── */

function SelectorPeriodo({
  periodo,
  onChange,
}: {
  periodo: PeriodoV05;
  onChange: (p: PeriodoV05) => void;
}) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  function onKeyDown(e: React.KeyboardEvent, idx: number) {
    const next = rovingIndex(idx, e.key, PERIODOS.length);
    if (next === null) return;
    e.preventDefault();
    onChange(PERIODOS[next]!);
    refs.current[next]?.focus();
  }
  return (
    <span className="mt-1 block" role="radiogroup" aria-label="Período de Por pagar">
      {PERIODOS.map((p, idx) => (
        <button
          key={p}
          ref={(el) => {
            refs.current[idx] = el;
          }}
          type="button"
          role="radio"
          aria-checked={periodo === p}
          tabIndex={periodo === p ? 0 : -1}
          onKeyDown={(e) => onKeyDown(e, idx)}
          onClick={() => onChange(p)}
          className={cn(
            "mr-1 rounded-full border border-rediseno-hairline bg-rediseno-superficie px-2 py-0.5 text-[12px] font-semibold text-rediseno-tinta-2",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul",
            periodo === p && "border-rediseno-tinta bg-rediseno-tinta text-white",
          )}
        >
          {p} días
        </button>
      ))}
    </span>
  );
}

/* ── ⓘ (§1.4: definición, incluye/excluye, fuente y frescura) ────────────────── */

function InfoPopover({ label, info }: { label: string; info: ExplicacionV05 }) {
  return (
    <details className="group relative inline-block align-middle">
      <summary
        className="inline-flex cursor-pointer list-none items-center text-rediseno-tinta-3-light hover:text-rediseno-tinta-2 focus-visible:ring-2 focus-visible:ring-rediseno-azul focus-visible:outline-none [&::-webkit-details-marker]:hidden"
        aria-label={label}
      >
        <Info className="size-3.5" aria-hidden />
      </summary>
      <div className="absolute top-full left-0 z-40 mt-1.5 w-[min(22rem,80vw)] rounded-xl border border-rediseno-hairline bg-rediseno-superficie p-3 text-left text-[12.5px] leading-relaxed font-normal text-rediseno-tinta-2 normal-case tracking-normal shadow-lg">
        <p className="font-semibold text-rediseno-tinta">{info.definicion}</p>
        <Bloque titulo="Incluye" items={info.incluye} />
        <Bloque titulo="Deja afuera" items={info.excluye} />
        <p className="mt-2">
          <span className="font-rediseno-mono text-[12px] uppercase tracking-[.1em] text-rediseno-tinta-3">
            Fuente
          </span>{" "}
          <span className="font-rediseno-mono text-[12px]">{info.fuente}</span>
        </p>
        <p className="mt-1">
          <span className="font-rediseno-mono text-[12px] uppercase tracking-[.1em] text-rediseno-tinta-3">
            Frescura
          </span>{" "}
          {info.frescura}
        </p>
      </div>
    </details>
  );
}

function Bloque({ titulo, items }: { titulo: string; items: string[] }) {
  return (
    <div className="mt-2">
      <p className="font-rediseno-mono text-[12px] uppercase tracking-[.1em] text-rediseno-tinta-3">
        {titulo}
      </p>
      <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

/* ── (4) La tabla (§1.3 `.tw > table.t`, §5.5) ───────────────────────────────── */

const HREF_LABEL: Record<string, string> = {
  "/pagar/facturas-recibidas": "Ver en Facturas recibidas",
  "/pagar/impuestos": "Ver en Impuestos",
  "/pagar/obligaciones": "Ver en Préstamos y obligaciones",
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
                  {CERTEZA_LABEL[p.certeza]}
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
          if (p.moneda !== "CLP") return p.montoLabel;
          return formatClp(p.montoClp ?? 0);
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
    [rojo],
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
          {certezaLabelDe(p) && <Dato k="Certeza" v={certezaLabelDe(p)!} />}
          <Dato
            k="Monto"
            v={`${p.montoLabel}${p.moneda !== "CLP" && p.montoClp != null ? ` · ${formatClp(p.montoClp)} al tipo de cambio` : ""}`}
          />
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

/** Exportar (§5.5): descarga Excel con celdas tipadas en el navegador. Sólo corre en cliente. */
const descargarExcel = downloadXlsx;

function EstadoNomina({ ap }: { ap: AccountsPayableResponse }) {
  const next = ap.next_payroll;
  const cobertura = ap.payroll_coverage;
  if (next) {
    const currency = next.currency.trim().toUpperCase();
    const original = formatMoney(Number(next.amount), currency);
    const convertido =
      currency !== "CLP" && next.amount_clp != null
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
    .map((source) => `${source.source}: frescura no confirmada`)
    .join(" · ");
  return (
    <Banner role="status">
      <span>
        Próxima nómina: no determinada; la cobertura del período está incompleta
        {pendientes ? ` (${pendientes})` : ""}.
      </span>
    </Banner>
  );
}
