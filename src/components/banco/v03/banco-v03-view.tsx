"use client";

import * as React from "react";
import { downloadXlsx } from "@/lib/export/xlsx";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Info, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardSummaryV2 } from "@/lib/api/dashboard";
import type { SourceStatus } from "@/lib/api/sources-status";
import type {
  BankAccountItem,
  BankMovement,
  BiceAccount,
  SaldoResponse,
  TarjetaSaldoData,
  TarjetasResponse,
} from "@/lib/api/treasury";
import { cajaHoy } from "@/lib/finanzas/caja-hoy";
import { formatClp, formatMoney } from "@/lib/formatters/clp";
import { Banner } from "@/components/rediseno/banner";
import { DataState } from "@/components/rediseno/data-state";
import { FilterChips } from "@/components/rediseno/filter-chip";
import { KpiCard } from "@/components/rediseno/kpi-card";
import { Pill } from "@/components/rediseno/pill";
import { SinDato } from "@/components/rediseno/sin-dato";
import { RedisenoTable, TablePrimaryCell } from "@/components/rediseno/table";
import {
  CLASIFICACION_PILL,
  CONCILIACION_PILL,
  chipCajaHoy,
  conexionBanco,
  contarMovimientosV03,
  csvMovimientosTable,
  cuadreCajaHoy,
  cuentasV03,
  filtrarMovimientosV03,
  fuenteBanco,
  hrefClasificar,
  montoConSigno,
  movimientosV03,
  pendientesPorCuenta,
  subMovimiento,
  sumaPorMoneda,
  tarjetasV03,
  textoActualizando,
  totalesPorMoneda,
  type CuentaV03,
  type FiltroClasificacion,
  type FiltroConciliacion,
  type FiltroMovimientos,
  type MovimientoV03,
} from "./banco-v03-model";
import { BankResolutionDetailDrawer } from "./bank-resolution-detail-drawer";
import {
  resolutionDetailFromMovement,
  type BankMovementResolutionDetail,
} from "./bank-resolution-detail-model";
import type { BankResolutionDetailDrawerProps } from "./bank-resolution-detail-drawer";

/* V03 · Banco — "tus cuentas y tarjetas, con su estado, y cada movimiento con su ciclo de vida"
 * (rediseño Fase 2, issue #68).
 *
 * PRESENTACIONAL: entran las respuestas crudas de los endpoints, sale una pantalla. Sin hooks de
 * datos — el cableado vive en `banco-v03-live.tsx`. Así la vista entera se renderea en un test
 * (`react-dom/server`) y en una story sin MSW.
 *
 * LEY 1 — el número "Caja hoy" sale de `cajaHoy(summary)`, la MISMA función que V01 y V02. La
 * tabla de cuentas muestra OTRO concepto con OTRO apellido: el saldo contable que el banco informa
 * en vivo, por cuenta y por moneda. `cuadreCajaHoy` compara los dos y la vista lo dice cuando no
 * coinciden, en vez de esconder uno. `banco-v03-view.test.tsx` fija con un sentinel que el KPI no
 * desarma `cash_today` por su cuenta.
 *
 * LEY 2 — CERO rojos en esta vista. Una conexión que requiere acción va en ámbar (`Pill warn` +
 * `Banner warn`), igual que `DataState` en error: es "requiere tu acción", no una emergencia de
 * plata. Un movimiento sin clasificar es progreso (ámbar), un cargo es tinta. Las stories y el test
 * CUENTAN `rediseno-rojo` + `danger-` sobre el DOM: cero en los cinco estados.
 *
 * "NO SÉ" explícito — sin saldo del banco la celda dice "sin dato" con motivo (`SinDato`), nunca
 * $0; sin dato de conexión el pill dice "Sin dato de conexión", nunca "Conectada ✓".
 *
 * LO QUE FALTA, dicho acá y no sólo en el PR: (1) la contraparte NO viene como campo del
 * movimiento — la glosa va completa (Ley 7); (2) "Actualizando" usa `sync_progress` publicado
 * por la fuente: sin ETA muestra el tiempo transcurrido y declara esa ausencia; (3) "Clasificar" abre el
 * Bandeja V07 (`/bandeja`), que concentra las excepciones de clasificación. El flujo detallado
 * legado sigue disponible dentro de la Bandeja cuando hace falta clasificar un movimiento a mano. */

export interface BancoV03ViewProps {
  /** `GET /api/dashboard/summary`. `null` = no llegó. */
  summary: DashboardSummaryV2 | null;
  /** `GET /api/bice/saldo`. `null` = no llegó. Con sesión vencida llega `status:"error"`. */
  saldo: SaldoResponse | null;
  /** `GET /api/bice/tarjetas`. */
  tarjetas: TarjetasResponse | null;
  /** `operationNumber → cupo` (`GET /api/bice/tarjetas/{op}/saldo`). */
  saldoPorTarjeta?: ReadonlyMap<string, TarjetaSaldoData>;
  /** `GET /api/treasury/bank-accounts?active=false`. */
  cuentasQavante: BankAccountItem[] | null;
  /** `GET /api/bank-movements/bice/accounts` (vínculo bice ↔ Qavante). */
  links: BiceAccount[] | null;
  /** `GET /api/sources/status`. `null` = no llegó. */
  sources: SourceStatus[] | null;
  /** `GET /api/bank-movements` (últimos meses). `null` = no llegó. */
  movimientos: BankMovement[] | null;
  /** `total` del backend (sin paginar), para declarar si se muestra todo. */
  movimientosTotal?: number | null;
  /** Por qué no llegaron los movimientos, en lenguaje de dueño. */
  movimientosMotivo?: string | null;
  /** `code → label` de las categorías canónicas. */
  categorias?: ReadonlyMap<string, string>;
  /** Read model de #428. Ausente = detalle mínimo y honesto desde BankMovement. */
  resolutionDetails?: ReadonlyMap<string, BankMovementResolutionDetail>;
  /** Movimiento cargado por enlace directo, incluso si queda fuera del período visible. */
  deepLinkedMovement?: MovimientoV03 | null;
  onUnreconcile?: (movementId: string) => void;
  onReclassify?: (movementId: string) => void;
  onUnclassify?: (movementId: string) => void;
  selectedAccountId?: string;
  onAccountChange?: (accountId: string) => void;
  onOpenMovement?: (movementId: string) => void;
  classificationEditor?: BankResolutionDetailDrawerProps["classificationEditor"];
  /** Alcance declarado de la lista, nombrado por sus meses ("agosto a octubre de 2026").
   *  No dice "los últimos 3 meses": la ventana es de MESES CALENDARIO y ese texto prometía
   *  noventa días que nunca cubrió (B17). Lo arma `alcanceDeLaCartola` en el contenedor. */
  alcance?: string;
  cuentasCargando?: boolean;
  movimientosCargando?: boolean;
  /** Refetch en curso (react-query `isFetching` con datos previos en pantalla). */
  refrescando?: boolean;
  /** Nombre del banco para el chip y los banners. Sin prop, sale de `display_name` de la fuente de
   *  banco en `/api/sources/status`; sin eso, "Banco" (neutro: no se hardcodea un proveedor). */
  banco?: string;
  /** Referencia de "hoy". Explícita para tests y stories deterministas. */
  hoy?: Date;
}

const LINK =
  "font-semibold text-rediseno-azul hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul rounded";
const PILL_OSCURA =
  "ml-auto inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-rediseno-tinta px-4 py-2 text-[12.5px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul";

const FILTROS: ReadonlyArray<{ id: FiltroMovimientos; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "abonos", label: "Abonos" },
  { id: "cargos", label: "Cargos" },
];

export function BancoV03View({
  summary,
  saldo,
  tarjetas,
  saldoPorTarjeta = new Map(),
  cuentasQavante,
  links,
  sources,
  movimientos,
  movimientosTotal,
  movimientosMotivo,
  categorias = new Map(),
  resolutionDetails = new Map(),
  deepLinkedMovement = null,
  onUnreconcile,
  onReclassify,
  onUnclassify,
  selectedAccountId,
  onAccountChange,
  onOpenMovement,
  classificationEditor,
  alcance = "los meses en pantalla",
  cuentasCargando = false,
  movimientosCargando = false,
  refrescando = false,
  banco: bancoProp,
  hoy = new Date(),
}: BancoV03ViewProps) {
  const banco = bancoProp ?? fuenteBanco(sources)?.display_name?.trim() ?? "Banco";
  const [filtro, setFiltro] = React.useState<FiltroMovimientos>("todos");
  const [filtroConciliacion, setFiltroConciliacion] = React.useState<FiltroConciliacion>("todos");
  const [filtroClasificacion, setFiltroClasificacion] =
    React.useState<FiltroClasificacion>("todos");
  const [consulta, setConsulta] = React.useState("");
  const [cuentaSeleccionada, setCuentaSeleccionada] = React.useState("");
  const [movimientoAbierto, setMovimientoAbierto] = React.useState<string | null>(null);
  const deepLinkOpened = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!deepLinkedMovement || deepLinkOpened.current === deepLinkedMovement.id) return;
    deepLinkOpened.current = deepLinkedMovement.id;
    setMovimientoAbierto(deepLinkedMovement.id);
  }, [deepLinkedMovement]);

  const caja = cajaHoy(summary);
  const conexion = conexionBanco(sources, saldo, tarjetas);
  const actualizando = textoActualizando(conexion, hoy);

  const cuentasMap = React.useMemo(
    () => new Map((cuentasQavante ?? []).map((a) => [a.id, a])),
    [cuentasQavante],
  );
  const movs = React.useMemo(
    () =>
      movimientos ? movimientosV03({ items: movimientos, cuentas: cuentasMap, categorias }) : null,
    [movimientos, cuentasMap, categorias],
  );
  /* En modo conectado `movimientos` ya viene filtrado por la cuenta elegida. No proyectamos ese
     subconjunto sobre las demás cuentas como si tuvieran cero pendientes. */
  const pendientes = selectedAccountId == null && movs ? pendientesPorCuenta(movs) : null;

  const filasCuentas = cuentasV03({
    banco,
    saldo,
    cuentasQavante,
    links,
    conexion,
    pendientes,
    hoy,
  });
  const filasTarjetas = tarjetasV03(
    banco,
    tarjetas,
    saldoPorTarjeta,
    conexion,
    hoy,
    cuentasQavante,
  );
  const filas = [...filasCuentas, ...filasTarjetas];
  const suma = sumaPorMoneda(filasCuentas);
  const cuadre = cuadreCajaHoy(caja, filasCuentas);

  const opcionesCuenta = (() => {
    const options = (cuentasQavante ?? [])
      .filter((a) => a.active && a.account_type !== "credit_card")
      .map((a) => ({ id: a.id, label: `${a.bank_name} · ${a.name}`, moneda: a.currency_code }));
    const known = new Set(options.map((option) => option.id));
    for (const movement of movs ?? []) {
      if (known.has(movement.bankAccountId)) continue;
      known.add(movement.bankAccountId);
      options.push({
        id: movement.bankAccountId,
        label: `${banco} · ${movement.cuenta}`,
        moneda: movement.moneda,
      });
    }
    if (deepLinkedMovement && !known.has(deepLinkedMovement.bankAccountId)) {
      options.push({
        id: deepLinkedMovement.bankAccountId,
        label: deepLinkedMovement.cuenta,
        moneda: deepLinkedMovement.moneda,
      });
    }
    return options;
  })();
  const requestedAccount = selectedAccountId ?? cuentaSeleccionada;
  const cuentaActiva = opcionesCuenta.some((a) => a.id === requestedAccount)
    ? requestedAccount
    : (opcionesCuenta[0]?.id ?? "");
  const movimientosDisponibles = [...(movs ?? [])];
  if (
    deepLinkedMovement &&
    !movimientosDisponibles.some((movement) => movement.id === deepLinkedMovement.id)
  ) {
    movimientosDisponibles.push(deepLinkedMovement);
  }
  const movimientosCuenta = movimientos
    ? movimientosDisponibles.filter((m) => m.bankAccountId === cuentaActiva)
    : null;
  const conteos = movimientosCuenta ? contarMovimientosV03(movimientosCuenta, consulta) : null;
  const visibles = movimientosCuenta
    ? filtrarMovimientosV03(
        movimientosCuenta,
        filtro,
        consulta,
        filtroConciliacion,
        filtroClasificacion,
      )
    : [];
  const totales = totalesPorMoneda(visibles);
  const rawMovement = movimientos?.find((m) => m.id === movimientoAbierto) ?? null;
  const openMovement =
    movs?.find((m) => m.id === movimientoAbierto) ??
    (deepLinkedMovement?.id === movimientoAbierto ? deepLinkedMovement : null);
  const openDetail =
    openMovement && resolutionDetails.has(openMovement.id)
      ? resolutionDetails.get(openMovement.id)!
      : openMovement && rawMovement
        ? resolutionDetailFromMovement(rawMovement, openMovement.categoria)
        : null;

  return (
    <div className="space-y-5">
      {/* Estado de la conexión que requiere acción: un banner ámbar con la acción (Ley 6/8). */}
      {conexion.estado === "accion_requerida" && (
        <Banner variant="warn" role="status">
          <b>Tu sesión con {banco} no está disponible.</b>{" "}
          {conexion.ultimaSync
            ? `Desde el ${fechaCorta(conexion.ultimaSync)} no llegan saldos ni movimientos nuevos; lo que ves abajo es lo último que importamos.`
            : "No están llegando saldos ni movimientos nuevos; lo que ves abajo es lo último que importamos."}{" "}
          Reconecta el banco para volver a verlos al día.
          <Link href="/conexiones" className={cn(PILL_OSCURA, "mt-2 sm:mt-0 sm:ml-3")}>
            Reconectar {banco}
          </Link>
        </Banner>
      )}

      {/* (0) Caja hoy — Ley 1: el MISMO número que en Hoy y Caja. */}
      <section aria-label="Caja hoy" className="grid gap-3 sm:grid-cols-3">
        {caja.monto != null ? (
          <KpiCard
            label="Caja hoy"
            period={chipCajaHoy(caja, banco, hoy)}
            value={formatClp(caja.monto)}
            detail={<DetalleCajaHoy cuadre={cuadre} estado={caja.estado} />}
          />
        ) : (
          <KpiCard
            label="Caja hoy"
            period={chipCajaHoy(caja, banco, hoy)}
            sinDato={{
              reason:
                "Todavía no tenemos el saldo de tu caja: el resumen no trajo el bloque de caja (banco sin conectar o fuente caída).",
            }}
            detail="El mismo número que en Hoy y Caja · según tus movimientos importados"
          />
        )}
      </section>

      {/* (1) Cuentas */}
      <section aria-labelledby="v03-cuentas" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="v03-cuentas"
            className="font-rediseno-mono text-[12px] font-semibold tracking-[.12em] text-rediseno-tinta-3 uppercase"
          >
            Cuentas
          </h2>
          {refrescando && (
            <span
              className="inline-flex items-center gap-1.5 text-[12.5px] text-rediseno-tinta-3"
              aria-live="polite"
            >
              <RefreshCw className="size-3.5 animate-spin" aria-hidden />
              Actualizando saldos con el banco ({actualizando})
            </span>
          )}
        </div>

        {cuentasCargando && filas.length === 0 ? (
          <CargandoCuentas banco={banco} detalle={actualizando} />
        ) : filas.length === 0 ? (
          conexion.estado === "sin_conectar" ? (
            <DataState
              status="empty"
              what="cuentas de banco"
              hint="Conecta tu banco y vas a ver acá cada cuenta con su saldo, su estado de conexión y sus movimientos."
              action={{ label: "Conectar un banco", href: "/conexiones" }}
            />
          ) : (
            <DataState
              status="error"
              what="tus cuentas de banco"
              cause={
                conexion.motivo ??
                "Ni el banco ni el estado de tus conexiones respondieron. No sabemos qué cuentas tienes ni cuánto hay en ellas."
              }
              action={{ label: "Revisar conexiones", href: "/conexiones" }}
            />
          )
        ) : (
          <>
            <TablaCuentas filas={filas} conexion={conexion} />
            <p className="text-[12.5px] text-rediseno-tinta-3">
              {suma.porMoneda.length > 0 ? (
                <>
                  Saldo contable según el banco, por moneda:{" "}
                  {suma.porMoneda.map((m, i) => (
                    <span key={m.moneda} className="tabular-nums text-rediseno-tinta-2">
                      {i > 0 && " · "}
                      {m.moneda} {formatMoney(m.total, m.moneda)} ({m.cuentas}{" "}
                      {m.cuentas === 1 ? "cuenta" : "cuentas"})
                    </span>
                  ))}
                  {suma.sinSaldo > 0 && (
                    <> · {suma.sinSaldo} sin saldo informado, fuera del total</>
                  )}
                  {suma.sinMoneda > 0 && (
                    <> · {suma.sinMoneda} sin moneda informada, fuera del total</>
                  )}
                  . Las monedas no se suman entre sí.
                </>
              ) : (
                <>
                  Sin saldos del banco para sumar: {suma.sinSaldo}{" "}
                  {suma.sinSaldo === 1 ? "cuenta" : "cuentas"} sin saldo informado.
                </>
              )}
            </p>
          </>
        )}
      </section>

      {/* (3) Filtros + (4) Movimientos */}
      <section aria-labelledby="v03-movimientos" className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="v03-movimientos"
              className="font-rediseno-mono text-[12px] font-semibold tracking-[.12em] text-rediseno-tinta-3 uppercase"
            >
              Cartola · {alcance}
            </h2>
            <p className="mt-1 text-xs text-rediseno-tinta-3">
              Una cuenta y una moneda a la vez; no se mezclan cartolas.
            </p>
          </div>
          {opcionesCuenta.length > 0 && (
            <label className="text-xs font-semibold text-rediseno-tinta-2">
              Cuenta
              <select
                aria-label="Cuenta de la cartola"
                value={cuentaActiva}
                onChange={(event) => {
                  if (onAccountChange) onAccountChange(event.target.value);
                  else setCuentaSeleccionada(event.target.value);
                  setMovimientoAbierto(null);
                }}
                className="ml-2 rounded-full border border-rediseno-hairline bg-rediseno-superficie px-3 py-2 font-normal text-rediseno-tinta focus-visible:ring-2 focus-visible:ring-rediseno-azul focus-visible:outline-none"
              >
                {opcionesCuenta.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} · {option.moneda}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {movimientosCargando && movs == null ? (
          <CargandoMovimientos />
        ) : movs == null ? (
          <DataState
            status="error"
            what="los movimientos del banco"
            cause={
              movimientosMotivo ??
              "El listado de movimientos no respondió. Vuelve a intentar en un momento."
            }
          />
        ) : movs.length === 0 ? (
          <DataState
            status="empty"
            what="movimientos del banco"
            hint={
              conexion.estado === "accion_requerida"
                ? `El banco no está mandando movimientos desde que se venció la sesión. Reconecta ${banco} para que vuelvan a llegar.`
                : conexion.estado === "sin_conectar"
                  ? "Conecta tu banco para que empiecen a llegar."
                  : `No hay movimientos importados en ${alcance}. Si el banco sí tuvo movimientos, revisa la conexión.`
            }
            action={{ label: "Revisar conexiones", href: "/conexiones" }}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <label className="relative min-w-0 flex-1 basis-[16rem]">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-rediseno-tinta-3-light"
                  aria-hidden
                />
                <span className="sr-only">Buscar por glosa, RUT o monto</span>
                <input
                  type="search"
                  value={consulta}
                  onChange={(e) => setConsulta(e.target.value)}
                  placeholder="Buscar por glosa, RUT o monto…"
                  className="w-full rounded-full border border-rediseno-hairline bg-rediseno-superficie py-[7px] pr-3 pl-9 text-xs text-rediseno-tinta placeholder:text-rediseno-tinta-3-light focus-visible:ring-2 focus-visible:ring-rediseno-azul focus-visible:outline-none"
                />
              </label>
              <FilterChips
                aria-label="Filtrar por tipo de movimiento"
                className="mt-0 mb-0"
                options={FILTROS.map((f) => ({
                  ...f,
                  count: conteos
                    ? f.id === "todos"
                      ? conteos.todos
                      : f.id === "abonos"
                        ? conteos.abonos
                        : conteos.cargos
                    : 0,
                }))}
                value={filtro}
                onChange={setFiltro}
              />
              <label className="text-xs text-rediseno-tinta-3">
                Conciliación
                <select
                  aria-label="Filtrar por conciliación"
                  value={filtroConciliacion}
                  onChange={(event) =>
                    setFiltroConciliacion(event.target.value as FiltroConciliacion)
                  }
                  className="ml-1 rounded-full border border-rediseno-hairline bg-rediseno-superficie px-3 py-2 text-rediseno-tinta focus-visible:ring-2 focus-visible:ring-rediseno-azul focus-visible:outline-none"
                >
                  <option value="todos">Todos</option>
                  <option value="pendiente">Pendientes</option>
                  <option value="parcial">Parciales</option>
                  <option value="conciliado">Conciliados</option>
                  <option value="excluido">Excluidos</option>
                  <option value="no_requerido">No requeridos</option>
                </select>
              </label>
              <label className="text-xs text-rediseno-tinta-3">
                Clasificación
                <select
                  aria-label="Filtrar por clasificación"
                  value={filtroClasificacion}
                  onChange={(event) =>
                    setFiltroClasificacion(event.target.value as FiltroClasificacion)
                  }
                  className="ml-1 rounded-full border border-rediseno-hairline bg-rediseno-superficie px-3 py-2 text-rediseno-tinta focus-visible:ring-2 focus-visible:ring-rediseno-azul focus-visible:outline-none"
                >
                  <option value="todos">Todos</option>
                  <option value="por_clasificar">Sin clasificar</option>
                  <option value="clasificado">Clasificados</option>
                  <option value="revision">Requieren revisión</option>
                </select>
              </label>
            </div>

            <TablaMovimientos
              movimientos={visibles}
              onExport={() =>
                descargarExcel(
                  `movimientos-${banco.toLowerCase()}.xlsx`,
                  csvMovimientosTable(visibles),
                )
              }
              emptyMessage={
                consulta.trim()
                  ? "Ningún movimiento coincide con esa búsqueda."
                  : "Ningún movimiento en este filtro."
              }
              onOpen={(movement) => {
                setMovimientoAbierto(movement.id);
                onOpenMovement?.(movement.id);
              }}
            />

            <p className="text-[12.5px] text-rediseno-tinta-3">
              {totales.length > 0 ? (
                totales.map((t, i) => (
                  <span key={t.moneda} className="tabular-nums">
                    {i > 0 && " · "}
                    <span className="text-rediseno-tinta-2">{t.moneda}</span>: abonos{" "}
                    <span className="text-rediseno-verde">{formatMoney(t.abonos, t.moneda)}</span>,
                    cargos{" "}
                    <span className="text-rediseno-tinta-2">{formatMoney(t.cargos, t.moneda)}</span>
                    , neto{" "}
                    <span className="text-rediseno-tinta-2">{formatMoney(t.neto, t.moneda)}</span> (
                    {t.n})
                  </span>
                ))
              ) : (
                <>Sin movimientos que sumar en este filtro.</>
              )}
              {movimientosTotal != null && movimientosTotal > movs.length && (
                <>
                  {" "}
                  · La API informó {movimientosTotal} movimientos entre todas tus cuentas en{" "}
                  {alcance}; esta cartola usa los {movs.length} que llegaron en la respuesta y los
                  conteos de arriba corresponden sólo a la cuenta elegida.
                </>
              )}
            </p>
          </>
        )}
      </section>
      {openMovement && openDetail && (
        <BankResolutionDetailDrawer
          open
          movement={openMovement}
          detail={openDetail}
          onClose={() => setMovimientoAbierto(null)}
          onUnreconcile={
            onUnreconcile && openDetail.reconciliation.canUnreconcile
              ? () => onUnreconcile(openMovement.id)
              : undefined
          }
          onReclassify={onReclassify ? () => onReclassify(openMovement.id) : undefined}
          onUnclassify={onUnclassify ? () => onUnclassify(openMovement.id) : undefined}
          classificationEditor={classificationEditor}
        />
      )}
    </div>
  );
}

/* ── Piezas ──────────────────────────────────────────────────────────────────── */

function fechaCorta(iso: string): string {
  /* Import local para no arrastrar el formateador a los props: la fecha corta de la spec. */
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "Sin información";
  const meses = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  return `${Number(m[3])} ${meses[Number(m[2]) - 1] ?? "Sin información"}`;
}

/** El apellido de "Caja hoy" + el cuadre con el banco, con su ⓘ (spec §1.4). */
function DetalleCajaHoy({
  cuadre,
  estado,
}: {
  cuadre: ReturnType<typeof cuadreCajaHoy>;
  estado: ReturnType<typeof cajaHoy>["estado"];
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1">
      <span>
        {estado === "stale"
          ? "Puede estar desactualizado · "
          : estado === "estimated"
            ? "Estimado · "
            : ""}
        el mismo número que en Hoy y Caja
      </span>
      <details className="group relative inline-block">
        <summary
          className="inline-flex cursor-pointer list-none items-center text-rediseno-tinta-3-light hover:text-rediseno-tinta-2 focus-visible:ring-2 focus-visible:ring-rediseno-azul focus-visible:outline-none [&::-webkit-details-marker]:hidden"
          aria-label="Qué es Caja hoy y cómo se compara con lo que informa el banco"
        >
          <Info className="size-3.5" aria-hidden />
        </summary>
        <span className="absolute top-full left-0 z-40 mt-1.5 block w-[min(20rem,80vw)] rounded-xl border border-rediseno-hairline bg-rediseno-superficie p-3 text-left text-[12.5px] leading-relaxed font-normal text-rediseno-tinta-2 normal-case shadow-lg">
          <span className="block font-semibold text-rediseno-tinta">Caja hoy</span>
          <span className="mt-1 block">
            Es tu saldo de apertura más todos los movimientos importados del banco, en pesos. Sale
            del resumen del dashboard: la misma fuente y el mismo número que en Hoy y en Caja.
          </span>
          <span className="mt-1 block">
            La tabla de abajo muestra otro dato: el <b>saldo contable que el banco informa</b> por
            cuenta, en vivo y en su moneda. Pueden diferir si hay movimientos que el banco ya
            contabilizó y todavía no importamos, o cuentas en otra moneda.
          </span>
          <span className="mt-1 block text-rediseno-tinta-3">
            {cuadre.coincide == null
              ? "Hoy no se pueden comparar: falta uno de los dos."
              : cuadre.coincide
                ? `Hoy coinciden: el banco informa ${formatClp(cuadre.sumaBancoClp!)} en tus cuentas CLP.`
                : `Hoy NO coinciden: el banco informa ${formatClp(cuadre.sumaBancoClp!)} en tus cuentas CLP (diferencia ${formatClp(cuadre.diferencia!)}).`}
          </span>
        </span>
      </details>
      {cuadre.coincide === false && (
        <span className="text-rediseno-ambar">
          · el banco informa {formatClp(cuadre.sumaBancoClp!)} en CLP
        </span>
      )}
    </span>
  );
}

function TablaCuentas({
  filas,
  conexion,
}: {
  filas: CuentaV03[];
  conexion: ReturnType<typeof conexionBanco>;
}) {
  const columns = React.useMemo<ColumnDef<CuentaV03, unknown>[]>(
    () => [
      {
        id: "cuenta",
        accessorFn: (f) => f.nombre,
        header: "Cuenta",
        meta: { principal: true },
        cell: ({ row }) => <TablePrimaryCell value={row.original.nombre} sub={row.original.sub} />,
      },
      {
        id: "estado",
        accessorFn: () => conexion.estado,
        header: "Estado",
        enableSorting: false,
        meta: { hideBelow: "sm" },
        cell: () => <Pill variant={conexion.tono}>{conexion.pill}</Pill>,
      },
      {
        id: "saldo",
        accessorFn: (f) => f.saldo ?? Number.NEGATIVE_INFINITY,
        header: "Saldo contable",
        meta: { align: "right" },
        cell: ({ row }) =>
          row.original.saldo == null ? (
            <SinDato
              variant="compact"
              label="el saldo de esta cuenta"
              reason={row.original.saldoMotivo ?? "El banco no informó el saldo."}
            />
          ) : (
            <span className={cn(row.original.saldo < 0 && "text-rediseno-tinta-2")}>
              {formatMoney(row.original.saldo, row.original.moneda)}
            </span>
          ),
      },
      {
        id: "accion",
        header: "",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) =>
          row.original.href ? (
            <Link href={row.original.href} className={LINK}>
              {row.original.accion}
            </Link>
          ) : (
            <span className="text-rediseno-tinta-3-light">sin cartola</span>
          ),
      },
    ],
    [conexion],
  );
  return <RedisenoTable columns={columns} data={filas} />;
}

function TablaMovimientos({
  movimientos,
  onExport,
  emptyMessage,
  onOpen,
}: {
  movimientos: MovimientoV03[];
  onExport: () => void;
  emptyMessage: string;
  onOpen: (movement: MovimientoV03) => void;
}) {
  const columns = React.useMemo<ColumnDef<MovimientoV03, unknown>[]>(
    () => [
      {
        id: "movimiento",
        accessorFn: (m) => m.fecha,
        header: "Movimiento",
        meta: { principal: true },
        cell: ({ row }) => (
          <TablePrimaryCell value={row.original.glosa} sub={subMovimiento(row.original)} />
        ),
      },
      {
        id: "conciliacion",
        accessorFn: (m) => m.estadoConciliacion,
        header: "Conciliación",
        meta: { hideBelow: "sm" },
        cell: ({ row }) => {
          const p = CONCILIACION_PILL[row.original.estadoConciliacion];
          return <Pill variant={p.tono}>{p.texto}</Pill>;
        },
      },
      {
        id: "clasificacion",
        accessorFn: (m) => m.estadoClasificacion,
        header: "Clasificación",
        meta: { hideBelow: "md" },
        cell: ({ row }) => {
          const p = CLASIFICACION_PILL[row.original.estadoClasificacion];
          return <Pill variant={p.tono}>{p.texto}</Pill>;
        },
      },
      {
        id: "monto",
        accessorFn: (m) => m.monto,
        header: "Monto",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className={cn(row.original.esAbono && "text-rediseno-verde")}>
            {montoConSigno(row.original)}
          </span>
        ),
      },
      {
        id: "accion",
        header: "",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => {
          const m = row.original;
          if (m.estadoClasificacion === "por_clasificar") {
            return (
              <Link
                href={hrefClasificar()}
                onClick={(event) => event.stopPropagation()}
                className={cn(LINK, "font-bold")}
              >
                Clasificar
              </Link>
            );
          }
          return (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpen(m);
              }}
              className={LINK}
            >
              Ver detalle
            </button>
          );
        },
      },
    ],
    [onOpen],
  );
  return (
    <RedisenoTable
      columns={columns}
      data={movimientos}
      pageSize={50}
      onExport={onExport}
      emptyMessage={emptyMessage}
      onRowClick={onOpen}
      rowAriaLabel={(movement) => `Ver detalle de ${movement.glosa}`}
    />
  );
}

/* §5.4 — los estados de carga hablan: qué se trae y cuánto tarda. */
function CargandoCuentas({ banco, detalle }: { banco: string; detalle: string }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      <p className="text-sm text-rediseno-tinta-3">
        Consultando tus cuentas y tarjetas en {banco}: {detalle}.
      </p>
      <div className="h-28 animate-pulse rounded-[14px] bg-rediseno-neutro-bg" aria-hidden />
    </div>
  );
}

function CargandoMovimientos() {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      <p className="text-sm text-rediseno-tinta-3">
        Estamos trayendo tus movimientos importados del banco.
      </p>
      <div className="h-40 animate-pulse rounded-[14px] bg-rediseno-neutro-bg" aria-hidden />
    </div>
  );
}

/** Exportar (§5.5): descarga Excel con celdas tipadas en el navegador. Sólo corre en cliente. */
const descargarExcel = downloadXlsx;
