"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Info, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { rovingIndex } from "@/lib/a11y/roving";
import type { AccountsPayableResponse } from "@/lib/api/pagos";
import { formatClp } from "@/lib/formatters/clp";
import { concordar, formatCount, formatDays } from "@/lib/formatters/count";
import { Banner } from "@/components/rediseno/banner";
import { DataState } from "@/components/rediseno/data-state";
import { FilterChips } from "@/components/rediseno/filter-chip";
import { KpiCard } from "@/components/rediseno/kpi-card";
import { Pill } from "@/components/rediseno/pill";
import { RedisenoTable, TablePrimaryCell } from "@/components/rediseno/table";
import {
  FILTROS_V05,
  LEY_9_TEXTO,
  PERIODOS,
  TIPO_LABEL,
  TOPE_ITEMS,
  VENTANA_DIAS,
  bannerPostergables,
  contarPagos,
  csvPagos,
  elUnicoRojo,
  explicacionCritico,
  explicacionPorPagar,
  explicacionVencido,
  faltantes,
  filtrarPagos,
  kpiCritico,
  kpiPorPagar,
  kpiVencido,
  pagosV05,
  totales,
  type ExplicacionV05,
  type FiltroV05,
  type PagoV05,
  type PeriodoV05,
  type RojoV05,
} from "./pagar-v05-model";

/* V05 · Pagar — "¿a quién le pago, y qué es crítico?" (rediseño Fase 2, issue #70).
 *
 * PRESENTACIONAL: entra la respuesta de `accounts-payable`, sale una pantalla. Sin hooks de datos
 * — el cableado vive en `pagar-v05-live.tsx`. Así la vista entera se renderea en un test
 * (`react-dom/server`) y en una story sin MSW. El único estado propio es de UI: período de la
 * tarjeta "Por pagar", filtro y búsqueda.
 *
 * LEY 1 — "Por pagar · 14 días" es `due_14d` del contrato tal cual: el MISMO número que
 * "Sale · 14 días" en V02 · Caja. El postergable del banner sale de la MISMA función (`sale14d`
 * de `caja-v02-model`): un concepto, un número. La vista no recalcula esos tramos desde la tabla
 * (`items` está topeado y las monedas sin TC no suman).
 *
 * LEY 2 — máximo UN rojo por pantalla, decidido en el modelo (`elUnicoRojo`): la pill "Revisar"
 * del posible duplicado más urgente si hay alguno; si no, el relativo de la fila crítica más
 * urgente. El KPI "Vencido" NO va en rojo (el HTML de referencia lo pinta rojo; la spec manda en
 * lógica). Lo demás es ámbar o gris. Las stories y el test CUENTAN `rediseno-rojo` + `danger-`.
 *
 * LEY 9 — NO existe "pagar todo" ni "postergar": el texto fijo de la ley va literal bajo la
 * tabla, y el banner de postergables enlaza a Hoy (la ejecución masiva no vive aquí).
 *
 * "NO SÉ" explícito — una fila sin fecha parseable dice "sin fecha" (nunca "vence hoy" ni 0
 * días); los documentos sin vencimiento que el backend deja fuera de la tabla (`undated_*`) se
 * declaran con monto y conteo; la caja proyectada en otra moneda no se compara con pesos. */

export interface PagarV05ViewProps {
  /** `GET /api/treasury/accounts-payable`. `null` = no llegó. */
  pagos: AccountsPayableResponse | null;
  /** Por qué no llegó, en lenguaje de dueño (cuando `pagos` es null). */
  pagosMotivo?: string | null;
  onReintentar?: () => void;
  /** Issue sucesor de los huecos declarados (duplicados por backend, "Servicio", Postergar). */
  issueSucesor?: string;
  /** Referencia de "hoy". Explícita para tests y stories deterministas. */
  hoy?: Date;
}

const LINK =
  "font-semibold text-rediseno-azul hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul rounded";
const EYEBROW =
  "font-rediseno-mono text-[11px] font-semibold uppercase tracking-[.12em] text-rediseno-tinta-3";

export function PagarV05View({
  pagos: ap,
  pagosMotivo,
  onReintentar,
  issueSucesor,
  hoy = new Date(),
}: PagarV05ViewProps) {
  const [periodo, setPeriodo] = React.useState<PeriodoV05>(14);
  const [filtro, setFiltro] = React.useState<FiltroV05>("todos");
  const [consulta, setConsulta] = React.useState("");

  const filas = React.useMemo(() => pagosV05(ap, hoy), [ap, hoy]);
  const rojo = elUnicoRojo(filas);
  const vencido = kpiVencido(filas);
  const porPagar = kpiPorPagar(ap, periodo);
  const critico = kpiCritico(filas, ap);
  const banner = bannerPostergables(ap, hoy);
  const conteos = contarPagos(filas, consulta);
  const visibles = filtrarPagos(filas, filtro, consulta);
  const tot = totales(ap, filas);
  const falta = faltantes(ap);

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
  if (filas.length === 0 && (ap.undated_count ?? 0) === 0) {
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

  return (
    <div className="space-y-5">
      {/* (1) Tríada: Vencido / Por pagar · período / Crítico vs. caja. */}
      <section aria-label="Vencido, por pagar y crítico" className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Vencido"
          value={formatClp(vencido.total)}
          detail={
            <>
              {vencido.n > 0 ? (
                <>
                  {formatCount(vencido.n)} {concordar(vencido.n, "pago", "pagos")} · el más antiguo,{" "}
                  {formatDays(vencido.masAntiguoDias!)}
                  {vencido.noPostergable > 0 &&
                    ` · ${formatClp(vencido.noPostergable)} no se posterga`}
                  {vencido.sinConvertir > 0 &&
                    ` · +${vencido.sinConvertir} en otra moneda sin convertir`}
                </>
              ) : (
                "nada vencido entre los pagos con fecha"
              )}{" "}
              <InfoPopover label="Qué es Vencido" info={explicacionVencido(ap, hoy)} />
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
                    ` · ${porPagar.sinFecha.n} ${porPagar.sinFecha.n === 1 ? "documento" : "documentos"} por ${formatClp(porPagar.sinFecha.monto)} sin fecha, en ningún tramo`}{" "}
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
            sinDato={{ reason: "El backend no publicó este tramo." }}
            detail={<SelectorPeriodo periodo={periodo} onChange={setPeriodo} />}
          />
        )}
        <KpiCard
          label="Crítico vs. caja"
          value={formatClp(critico.total)}
          detail={
            <>
              {critico.n > 0
                ? `${critico.n} ${critico.n === 1 ? "pago que no se posterga" : "pagos que no se postergan"} en ${VENTANA_DIAS} días`
                : `nada que no se pueda postergar en ${VENTANA_DIAS} días`}
              {critico.yaVencido > 0 && ` · ${formatClp(critico.yaVencido)} ya vencido`}
              {critico.caja != null && critico.brecha != null ? (
                critico.brecha >= 0 ? (
                  <>
                    {" "}
                    · la caja proyectada ({formatClp(critico.caja)}) lo cubre, holgura{" "}
                    {formatClp(critico.brecha)}
                  </>
                ) : (
                  <>
                    {" "}
                    · caja proyectada {formatClp(critico.caja)}: faltan {formatClp(-critico.brecha)}{" "}
                    aun postergando lo negociable
                  </>
                )
              ) : (
                <> · {critico.motivoSinCaja}</>
              )}{" "}
              <InfoPopover label="Qué es Crítico vs. caja" info={explicacionCritico(ap, hoy)} />
            </>
          }
        />
      </section>

      {/* (2) Banner de postergables → la decisión vive en Hoy (la ejecución masiva NO vive aquí). */}
      {banner && (
        <Banner role="note">
          <span>
            <b className="text-rediseno-tinta">
              {formatClp(banner.monto)} de lo que vence en {VENTANA_DIAS} días es negociable
            </b>{" "}
            (proveedores y arriendos, por tipo de pago — el mismo número que en Caja). La decisión
            de qué postergar vive en Hoy; acá no hay ejecución masiva.
          </span>
          <Link
            href="/"
            className="ml-auto shrink-0 whitespace-nowrap rounded-full bg-rediseno-tinta px-4 py-2 text-[12.5px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul"
          >
            Ver Hoy
          </Link>
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
            options={FILTROS_V05.filter(
              (f) => !f.condicional || conteos[f.id] > 0 || filtro === f.id,
            ).map((f) => ({ id: f.id, label: f.label, count: conteos[f.id] }))}
            value={filtro}
            onChange={setFiltro}
          />
        </div>

        <TablaPagos
          pagos={visibles}
          totalPagos={filas.length}
          rojo={rojo}
          onExport={() => descargarCsv("pagos-por-pagar.csv", csvPagos(visibles))}
          emptyMessage={
            consulta.trim()
              ? "Ningún pago coincide con esa búsqueda."
              : "Ningún pago en este filtro."
          }
        />

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

        {/* Ley 9 (texto fijo, literal) + huecos declarados. */}
        <p className="text-[12px] leading-relaxed text-rediseno-tinta-3">
          <b className="font-semibold text-rediseno-tinta-2">
            No existe un botón “pagar todo”, y postergar no es una acción aquí:
          </b>{" "}
          mover plata siempre lleva firma humana. {LEY_9_TEXTO} No hay cómo mover una fecha que la
          proyección lea (#80), así que cada pago enlaza a su detalle en vez de prometer una acción
          muda. El “posible duplicado” se calcula en esta pantalla sobre los pagos listados —mismo
          RUT, monto a ±1 % y vencimientos a 30 días— y la pill “Servicio” de la spec no se produce:
          el contrato no distingue un servicio recurrente de una factura cualquiera
          {issueSucesor ? ` (${issueSucesor})` : ""}.
        </p>
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
            "mr-1 rounded-full border border-rediseno-hairline bg-rediseno-superficie px-2 py-0.5 text-[10.5px] font-semibold text-rediseno-tinta-2",
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
          <span className="font-rediseno-mono text-[10px] uppercase tracking-[.1em] text-rediseno-tinta-3">
            Fuente
          </span>{" "}
          <span className="font-rediseno-mono text-[11px]">{info.fuente}</span>
        </p>
        <p className="mt-1">
          <span className="font-rediseno-mono text-[10px] uppercase tracking-[.1em] text-rediseno-tinta-3">
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
      <p className="font-rediseno-mono text-[10px] uppercase tracking-[.1em] text-rediseno-tinta-3">
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
}: {
  pagos: PagoV05[];
  totalPagos: number;
  rojo: RojoV05;
  onExport: () => void;
  emptyMessage: string;
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
            <span className="whitespace-nowrap">
              {p.venceLabel} ·{" "}
              <span
                className={cn(
                  /* Ley 2: el relativo rojo es UNO — la fila crítica más urgente, y sólo cuando
                     ningún duplicado se llevó el rojo de la pantalla. Lo vencido va en ámbar. */
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
          );
        },
      },
      {
        id: "tipo",
        accessorFn: (p) => TIPO_LABEL[p.tipo],
        header: "Tipo",
        meta: { hideBelow: "sm" },
        cell: ({ row }) => {
          const p = row.original;
          if (p.anomalia) {
            /* Ley 2: la pill roja es UNA — el duplicado más urgente; los demás en ámbar. */
            const esElRojo = rojo?.motivo === "anomalia" && rojo.key === p.key;
            return <Pill variant={esElRojo ? "bad" : "warn"}>{TIPO_LABEL.revisar}</Pill>;
          }
          const variant = p.tipo === "credito" ? "blue" : p.tipo === "negociable" ? "warn" : "mut";
          return <Pill variant={variant}>{TIPO_LABEL[p.tipo]}</Pill>;
        },
      },
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
      pageSize={25}
      onExport={onExport}
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
        <dl className="mt-1 space-y-0.5">
          {p.documento && <Dato k="Documento" v={p.documento} />}
          {p.rutLabel && <Dato k="RUT" v={p.rutLabel} />}
          <Dato k="Fuente" v={p.fuente} />
          <Dato
            k="Vence"
            v={p.dias == null ? "sin fecha" : `${p.venceLabel} (${p.relativoLabel})`}
          />
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
      <dt className="shrink-0 font-rediseno-mono text-[10px] uppercase tracking-[.1em] text-rediseno-tinta-3">
        {k}
      </dt>
      <dd className="min-w-0">{v}</dd>
    </div>
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
