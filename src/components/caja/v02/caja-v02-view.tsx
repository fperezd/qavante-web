"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import type { DashboardSummaryV2 } from "@/lib/api/dashboard";
import type {
  CashProjectionResponse,
  CollectionForecastResponse,
  UnclassifiedSummary,
} from "@/lib/api/treasury";
import type { AccountsPayableResponse } from "@/lib/api/pagos";
import { cajaHoy } from "@/lib/finanzas/caja-hoy";
import { formatClp, formatClpCompact } from "@/lib/formatters/clp";
import { KpiCard } from "@/components/rediseno/kpi-card";
import { Banner } from "@/components/rediseno/banner";
import { Pill } from "@/components/rediseno/pill";
import { DataState } from "@/components/rediseno/data-state";
import { RedisenoTable, TablePrimaryCell } from "@/components/rediseno/table";
import { concordar } from "@/lib/formatters/count";
import type { PostponeDays } from "@/lib/api/pagos";
import {
  SEMANAS,
  VENTANA_DIAS,
  causasDelPiso,
  deudaDeDatos,
  entra14d,
  fechaQuiebre,
  kpiHoy,
  puntoMasBajo,
  sale14d,
  semanas,
  type CausaV02,
  type NoPostergable14V02,
  type SemanaV02,
} from "./caja-v02-model";
import { PostponePayableControl } from "./postpone-payable-control";

/** Apellido de "Sale · 14 días": el agregado no postergable/vencido tal como lo publica el
 *  servidor. Un agregado parcial se dice "al menos"; uno ausente se declara, nunca se aproxima. */
function noPostergableTexto(np: NoPostergable14V02 | null): string {
  if (!np) return "monto crítico sin dato";
  const pagos = `${np.n} ${concordar(np.n, "pago crítico", "pagos críticos")}`;
  if (np.completo && np.monto != null) {
    return `${formatClp(np.monto)} críticos · ${pagos}`;
  }
  if (np.conocido > 0) {
    return `al menos ${formatClp(np.conocido)} críticos · ${pagos}`;
  }
  return `${pagos} · monto sin dato`;
}

/* V02 · Caja — "¿me alcanza la caja?" (rediseño Fase 2, issue #67).
 *
 * PRESENTACIONAL: entran las respuestas de los cuatro endpoints, sale una pantalla. Sin hooks de
 * datos — el cableado vive en `caja-v02-live.tsx`. Así la vista entera se renderea en un test y
 * en una story sin MSW.
 *
 * LEY 1 — el número "Hoy" sale de `cajaHoy(summary)`, la MISMA función que V01. La vista no toca
 * `cash_today`: se lo pasa resuelto al modelo (`kpiHoy`). `caja-v02-view.test.tsx` lo fija con un
 * sentinel: si alguien vuelve a desarmar el bloque a mano, el número renderizado cambia y el test
 * se cae.
 *
 * LEY 2 — máximo UN rojo por pantalla: el ÚNICO elemento con token rojo de este archivo es la
 * barra de la semana del punto más bajo, y sólo cuando ese mínimo queda bajo cero. Un saldo de hoy
 * negativo se muestra con su menos tipográfico en tinta (no es un segundo rojo); "vencido" va en
 * ámbar; el "no sé" en gris. Las stories cuentan `rediseno-rojo` + `danger-` sobre el DOM.
 *
 * POSTERGAR (Ley 4/9): sólo aparece con el `payable_id` publicado por la proyección; nunca se
 * infiere una identidad desde el texto. Antes del POST hay cinco segundos cancelables (incluido
 * Escape); impuestos, remuneraciones y causas sin UUID conservan sólo su enlace a Pagar. */

export interface CajaV02ViewProps {
  /** `GET /api/dashboard/summary`. `null` = no llegó. */
  summary: DashboardSummaryV2 | null;
  /** `GET /api/treasury/cash-projection`. `null` = no llegó (404 sin saldo de apertura, error). */
  proyeccion: CashProjectionResponse | null;
  /** Por qué no hay proyección, en lenguaje de dueño. Se muestra en lugar de las barras. */
  proyeccionMotivo?: string | null;
  /** `GET /api/treasury/collection-forecast`. */
  cobranza: CollectionForecastResponse | null;
  /** `GET /api/treasury/accounts-payable`. */
  pagos: AccountsPayableResponse | null;
  /** Movimientos sin clasificar (por moneda). */
  sinClasificar: UnclassifiedSummary | null;
  /** Nombres de banco de las cuentas activas (para el chip del KPI Hoy). */
  bancos?: readonly string[];
  /** El saldo falta por un ERROR del dashboard, no porque el banco esté sin conectar. */
  saldoError?: boolean;
  /** Ejecuta el POST sólo cuando terminó la ventana cancelable. */
  onPostpone: (payableId: string, days: PostponeDays) => Promise<void>;
  /** El Brief server-owned ya resolvió la decisión; este tablero conserva sólo evidencia. */
  suppressRecommendations?: boolean;
  /** Referencia de "hoy". Explícita para tests y stories deterministas. */
  hoy?: Date;
  /** D03: reemplaza íntegramente las secciones derivadas del endpoint legacy. */
  canonicalProjection?: React.ReactNode;
}

const LINK =
  "font-semibold text-rediseno-azul hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul rounded";

export function CajaV02View({
  summary,
  proyeccion,
  proyeccionMotivo,
  cobranza,
  pagos,
  sinClasificar,
  bancos = [],
  saldoError = false,
  onPostpone,
  suppressRecommendations = false,
  hoy = new Date(),
  canonicalProjection,
}: CajaV02ViewProps) {
  const caja = cajaHoy(summary);
  const hoyKpi = kpiHoy(caja, bancos, hoy);
  const entra = entra14d(cobranza);
  const sale = sale14d(pagos);
  const deuda = deudaDeDatos(sinClasificar);
  const piso = puntoMasBajo(proyeccion);
  const barras = semanas(proyeccion);
  const causas = causasDelPiso(proyeccion, {
    order: suppressRecommendations ? "source" : "amount",
    includePostergabilidad: !suppressRecommendations,
  });
  const quiebre = fechaQuiebre(proyeccion);

  return (
    <div className="space-y-5">
      {/* (1) Tríada KPI */}
      <section aria-label="Hoy, entra y sale" className="grid gap-3 sm:grid-cols-3">
        {hoyKpi.valor != null ? (
          <KpiCard
            label="Hoy"
            period={hoyKpi.chip ?? undefined}
            value={hoyKpi.valor}
            detail={hoyKpi.detalle}
          />
        ) : (
          <KpiCard
            label="Hoy"
            sinDato={{
              reason: saldoError
                ? "No pudimos traer tu saldo ahora (hubo un error). Vuelve a intentar en un momento."
                : "Todavía no tenemos el saldo de tu banco.",
            }}
            detail={hoyKpi.detalle}
          />
        )}
        {entra ? (
          <KpiCard
            label={`Entra · ${VENTANA_DIAS} días`}
            value={`+${formatClp(entra.esperado)}`}
            tone="ok"
            detail={`${formatClp(entra.nominal)} por cobrar`}
          />
        ) : (
          <KpiCard
            label={`Entra · ${VENTANA_DIAS} días`}
            sinDato={{ reason: "Todavía no tenemos el forecast de cobranza." }}
            detail="cobros con fecha"
          />
        )}
        {sale ? (
          <KpiCard
            label={`Sale · ${VENTANA_DIAS} días`}
            value={formatClp(-sale.total)}
            detail={
              <>
                {/* Apellido (Ley 1): due_14d es acumulativo e incluye lo YA vencido. Lo que no se
                    posterga sale del agregado del servidor (`non_postponable_or_overdue_14d`), el
                    MISMO que V05 publica como "Pagos críticos en todo el registro"; el contrato no
                    publica cuánto es negociable y esta pantalla no lo reconstruye (#302 P2-6). */}
                Incluye lo vencido · {noPostergableTexto(sale.noPostergable)}
              </>
            }
          />
        ) : (
          <KpiCard
            label={`Sale · ${VENTANA_DIAS} días`}
            sinDato={{ reason: "Todavía no tenemos tus cuentas por pagar." }}
            detail="pagos comprometidos"
          />
        )}
      </section>

      {/* (2) Calidad del dato. Nunca reemplaza la lectura principal de caja ni pide clasificar como
          siguiente acción: deja el detalle disponible en auditoría. En error, el aviso NO
          desaparece: un `count` en 0 por una consulta fallida no es "todo clasificado". */}
      {deuda?.error && (
        <Banner variant="warn" role="note">
          <span className="min-w-0 flex-1">
            <b className="text-rediseno-tinta">Faltan movimientos del banco.</b>
          </span>
        </Banner>
      )}
      {deuda && !deuda.error && (
        <Banner variant="warn" role="note">
          <div className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 flex-1">
              <b className="text-rediseno-tinta">{deuda.count}</b>{" "}
              {deuda.count === 1 ? "movimiento pendiente" : "movimientos pendientes"}
              {deuda.entradasLabel ? ` (~${deuda.entradasLabel} en entradas)` : ""}
              {deuda.entradasSinMoneda > 0
                ? ` y ${deuda.entradasSinMoneda} ${deuda.entradasSinMoneda === 1 ? "entrada" : "entradas"} cuya moneda no conocemos`
                : ""}
              .
            </span>
            <Link
              href="/bandeja"
              className="ml-auto inline-flex min-h-11 shrink-0 items-center whitespace-nowrap font-semibold text-brand-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul"
            >
              Revisar
            </Link>
          </div>
        </Banner>
      )}

      {canonicalProjection ?? (
        <>
          {/* (3) Barras de 4 semanas + ¿cómo se calcula? */}
          <section aria-labelledby="caja-semanas" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2
                id="caja-semanas"
                className="font-rediseno-mono text-[12px] font-semibold uppercase tracking-[.12em] text-rediseno-tinta-3"
              >
                Próximas {SEMANAS} semanas
              </h2>
            </div>
            {barras.length > 0 ? (
              <Barras semanas={barras} rojoEnPiso={piso?.bajoCero === true} />
            ) : (
              <DataState
                status="error"
                what="la proyección de caja"
                cause={
                  proyeccionMotivo ??
                  (caja.monto == null
                    ? "Sin el saldo del banco no hay punto de partida: no proyectamos una curva desde $0."
                    : "La proyección no trajo una serie de saldos.")
                }
                action={{ label: "Revisar conexiones", href: "/conexiones" }}
              />
            )}
          </section>

          {/* (4) Qué te lleva al punto más bajo */}
          {piso && (
            <section aria-labelledby="caja-piso" className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2
                  id="caja-piso"
                  className="font-rediseno-mono text-[12px] font-semibold uppercase tracking-[.12em] text-rediseno-tinta-3"
                >
                  {suppressRecommendations ? (
                    "Pagos registrados en la proyección"
                  ) : (
                    <>
                      Qué te lleva al punto más bajo · {piso.fechaLabel} ·{" "}
                      <span className="font-rediseno-sans normal-case tracking-normal tabular-nums text-rediseno-tinta">
                        {formatClp(piso.saldo)}
                      </span>
                    </>
                  )}
                </h2>
                {!suppressRecommendations && (
                  <Link href="/pagar" className={cn(LINK, "text-[12.5px]")}>
                    Ver todos los pagos
                  </Link>
                )}
              </div>
              {!suppressRecommendations && quiebre && (
                <p className="text-[12.5px] text-rediseno-tinta-3">
                  Mayores pagos antes de quedar bajo el mínimo ({quiebre}).
                </p>
              )}
              {causas.length > 0 && (
                <RedisenoTable
                  columns={columnasCausas(onPostpone, {
                    showDecisionSignals: !suppressRecommendations,
                  })}
                  data={causas}
                  emptyMessage="La proyección no nombra pagos para este punto."
                />
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

/* ── Barras (§1.3 `.bars`): entradas tinta, salidas rosado, crítico rojo ──────── */

function Barras({ semanas, rojoEnPiso }: { semanas: SemanaV02[]; rojoEnPiso: boolean }) {
  const max = Math.max(1, ...semanas.map((s) => Math.abs(s.neto)));
  return (
    <ol
      aria-label="Neto por semana"
      className="grid grid-cols-4 gap-2 rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie px-4 pb-3 pt-4"
    >
      {semanas.map((s) => {
        const alto = Math.max(4, Math.round((Math.abs(s.neto) / max) * 100));
        const critico = rojoEnPiso && s.esPiso;
        return (
          <li key={s.indice} className="flex flex-col items-center gap-1 text-center">
            <span
              className={cn(
                "font-rediseno-sans text-[12px] font-semibold tabular-nums",
                critico ? "text-rediseno-tinta" : "text-rediseno-tinta-2",
              )}
            >
              {s.neto >= 0 ? "+" : ""}
              {formatClpCompact(s.neto)}
            </span>
            <span className="flex h-24 w-full items-end justify-center">
              <i
                aria-hidden="true"
                data-piso={s.esPiso ? "true" : undefined}
                style={{ height: `${alto}%` }}
                className={cn(
                  "block w-8 rounded-t-md",
                  /* Ley 2: el ÚNICO rojo de la pantalla. */
                  critico
                    ? "bg-rediseno-rojo"
                    : s.neto >= 0
                      ? "bg-rediseno-flujo-entrada"
                      : "bg-rediseno-flujo-salida",
                )}
              />
            </span>
            <span className="font-rediseno-mono text-[12px] uppercase tracking-[.08em] text-rediseno-tinta-3">
              {s.label}
            </span>
            <span className="text-[12px] tabular-nums text-rediseno-tinta-3-light">
              cierra en {formatClp(s.cierre)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Tabla (§1.3 `.tw > table.t`) ─────────────────────────────────────────────── */

const TIPO_LABEL: Record<CausaV02["tipo"], string> = {
  pago: "Pago",
  impuesto: "Impuesto",
  vencido: "Vencido",
  otro: "Egreso",
};

function columnasCausas(
  onPostpone: (payableId: string, days: PostponeDays) => Promise<void>,
  { showDecisionSignals = true }: { showDecisionSignals?: boolean } = {},
): ColumnDef<CausaV02, unknown>[] {
  const columns: ColumnDef<CausaV02, unknown>[] = [
    {
      accessorKey: "glosa",
      header: "Pago",
      meta: { principal: true },
      cell: ({ row }) => (
        <TablePrimaryCell
          value={row.original.glosa}
          sub={
            showDecisionSignals
              ? `vence ${row.original.fechaLabel} · ${TIPO_LABEL[row.original.tipo].toLowerCase()}`
              : `vence ${row.original.fechaLabel}`
          }
        />
      ),
    },
  ];

  if (showDecisionSignals) {
    columns.push({
      id: "estado",
      header: "Estado",
      enableSorting: false,
      meta: { hideBelow: "sm" },
      cell: ({ row }) => {
        const c = row.original;
        /* Ley 9: la UI excluye impuestos y remuneraciones; el backend valida de nuevo. */
        if (c.postergable === "no") return <Pill variant="mut">No se posterga</Pill>;
        if (c.tipo === "vencido") return <Pill variant="warn">Vencido</Pill>;
        return <Pill variant="mut">{TIPO_LABEL[c.tipo]}</Pill>;
      },
    });
  }

  columns.push({
    accessorKey: "monto",
    header: "Monto",
    meta: { align: "right" },
    cell: ({ row }) => formatClp(row.original.monto),
  });

  if (showDecisionSignals) {
    columns.push({
      id: "accion",
      header: "",
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link href="/pagar" className={LINK}>
              Pagar
            </Link>
            {c.postergable === "si" && c.payableId && (
              <PostponePayableControl
                payableId={c.payableId}
                glosa={c.glosa}
                onPostpone={onPostpone}
              />
            )}
          </div>
        );
      },
    });
  }

  return columns;
}
