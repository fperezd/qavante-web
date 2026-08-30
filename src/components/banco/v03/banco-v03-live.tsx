"use client";

import * as React from "react";
import { useDashboardSummary } from "@/lib/api/dashboard";
import {
  useBankAccounts,
  useBankMovements,
  useBiceAccounts,
  useBiceSaldo,
  useBiceTarjetas,
  useBiceTarjetasSaldos,
  useCanonicalCategories,
} from "@/lib/api/treasury";
import { useSourcesStatus } from "@/lib/api/sources-status";
import { ApiError } from "@/lib/api/errors";
import { BancoV03View } from "./banco-v03-view";

/* Cableado de V03 · Banco. La vista es presentacional; acá se resuelven las fuentes:
 *
 *   · `GET /api/dashboard/summary`               — "Caja hoy" vía `cajaHoy()` (la MISMA fuente que V01/V02);
 *   · `GET /api/bice/saldo` + `/tarjetas` (+ saldo por tarjeta) — saldos y cupos que el banco informa en vivo;
 *   · `GET /api/treasury/bank-accounts?active=false` — las cuentas Qavante (filas cuando bice no
 *     responde; moneda y etiqueta de cada movimiento);
 *   · `GET /api/bank-movements/bice/accounts`     — el vínculo cuenta bice ↔ cuenta Qavante;
 *   · `GET /api/sources/status`                    — estado y frescura de la conexión;
 *   · `GET /api/bank-movements` (últimos 3 meses)  — los movimientos con su ciclo de vida;
 *   · `GET /api/treasury/canonical-categories`     — la etiqueta humana de cada categoría.
 *
 * Nada bloquea la pantalla entera: cada sección degrada a su propio "sin dato" con motivo. */

/** `YYYY-MM` de una fecha local. */
function periodo(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Cuántos meses hacia atrás se listan (declarado en la vista como alcance). */
export const MESES_ALCANCE = 3;
/** Filas que se piden de una: el MÁXIMO que el contrato permite (`BANK_MOVEMENTS_LIMIT_MAX`, 500; un
 *  `limit` mayor es 422 y tumba la sección entera). Por encima del tope, la vista lo declara
 *  ("mostrando N de M"). `banco-v03-live.test.ts` lo fija contra el contrato. */
export const LIMITE_MOVIMIENTOS = 500;

export function motivoSinMovimientos(err: unknown): string {
  if (err instanceof ApiError && err.isNetworkError()) {
    return "No pudimos conectar con el listado de movimientos (error de red). Vuelve a intentar en un momento.";
  }
  return "El listado de movimientos no respondió. Vuelve a intentar en un momento.";
}

export function BancoV03Live() {
  const [hoy] = React.useState(() => new Date());
  const desde = periodo(new Date(hoy.getFullYear(), hoy.getMonth() - (MESES_ALCANCE - 1), 1));
  const hasta = periodo(hoy);

  const dash = useDashboardSummary();
  const saldo = useBiceSaldo();
  const tarjetas = useBiceTarjetas();
  const ops = React.useMemo(
    () => (tarjetas.data?.data ?? []).map((t) => t.operationNumber),
    [tarjetas.data],
  );
  const { saldoPorTarjeta } = useBiceTarjetasSaldos(ops, ops.length > 0);
  const cuentas = useBankAccounts(true);
  const links = useBiceAccounts();
  const sources = useSourcesStatus();
  const movs = useBankMovements({
    period_from: desde,
    period_to: hasta,
    limit: LIMITE_MOVIMIENTOS,
  });
  const cats = useCanonicalCategories();

  const categorias = React.useMemo(
    () => new Map((cats.data?.items ?? []).map((c) => [c.code, c.label])),
    [cats.data],
  );

  return (
    <BancoV03View
      summary={dash.data ?? null}
      saldo={saldo.data ?? null}
      tarjetas={tarjetas.data ?? null}
      saldoPorTarjeta={saldoPorTarjeta}
      cuentasQavante={cuentas.data?.items ?? null}
      links={links.data?.accounts ?? null}
      sources={sources.data?.sources ?? null}
      movimientos={movs.data?.items ?? null}
      movimientosTotal={movs.data?.total ?? null}
      movimientosMotivo={movs.isError ? motivoSinMovimientos(movs.error) : null}
      categorias={categorias}
      alcance={`los últimos ${MESES_ALCANCE} meses`}
      cuentasCargando={saldo.isLoading || cuentas.isLoading}
      movimientosCargando={movs.isLoading}
      refrescando={!saldo.isLoading && (saldo.isFetching || tarjetas.isFetching)}
      hoy={hoy}
    />
  );
}
