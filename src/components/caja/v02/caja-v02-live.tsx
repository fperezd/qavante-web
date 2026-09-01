"use client";

import * as React from "react";
import { useDashboardSummary } from "@/lib/api/dashboard";
import {
  useBankAccounts,
  useCashProjection,
  useCollectionForecast,
  useUnclassifiedInRange,
} from "@/lib/api/treasury";
import { useAccountsPayable, usePostponePayable } from "@/lib/api/pagos";
import { ApiError } from "@/lib/api/errors";
import { CajaV02View } from "./caja-v02-view";

/* Cableado de V02 · Caja. La vista es presentacional; acá se resuelven las cinco fuentes:
 *
 *   · `GET /api/dashboard/summary`         — el saldo "Hoy" (vía `cajaHoy()`, la MISMA fuente que V01);
 *   · `GET /api/treasury/cash-projection`  — barras, punto más bajo, causas, exclusiones
 *                                            (caché compartida con el medidor de Caja v3);
 *   · `GET /api/treasury/collection-forecast` — Entra 14d;
 *   · `GET /api/treasury/accounts-payable`  — Sale 14d + postergable;
 *   · movimientos sin clasificar del mes en curso y el anterior — el banner de deuda de datos;
 *   · `GET /api/treasury/bank-accounts`     — sólo el NOMBRE del banco para el chip (no el saldo:
 *                                            el saldo sale del summary, Ley 1).
 *
 * Bloquean la pantalla sólo el summary y la proyección; el resto degrada por sección a su propio
 * "sin dato" con motivo. */

/** Período `YYYY-MM` de una fecha local. */
function periodo(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Por qué no hay proyección, en lenguaje de dueño. El backend responde 404 `no_opening_balance`
 *  cuando el tenant no tiene saldo de apertura: eso no es un error nuestro, es un dato que falta. */
export function motivoSinProyeccion(err: unknown): string {
  if (err instanceof ApiError && err.code === "no_opening_balance") {
    return "Tu empresa no tiene saldo de apertura en el banco: sin ese punto de partida no proyectamos.";
  }
  if (err instanceof ApiError && err.isNetworkError()) {
    return "No pudimos conectar con la proyección (error de red). Vuelve a intentar en un momento.";
  }
  return "No pudimos traer la proyección ahora. Vuelve a intentar en un momento.";
}

export function CajaV02Live() {
  const [hoy] = React.useState(() => new Date());
  const mesAnterior = periodo(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1));
  const mesActual = periodo(hoy);

  const dash = useDashboardSummary();
  const proj = useCashProjection(90);
  const cob = useCollectionForecast();
  const ap = useAccountsPayable();
  const cuentas = useBankAccounts();
  const sinClasificar = useUnclassifiedInRange(mesAnterior, mesActual);
  const postergar = usePostponePayable();

  if (dash.isLoading || proj.isLoading) return <CargandoCaja />;

  const bancos = (cuentas.data?.items ?? []).filter((a) => a.active).map((a) => a.bank_name);

  return (
    <CajaV02View
      summary={dash.data ?? null}
      saldoError={dash.isError}
      proyeccion={proj.data ?? null}
      proyeccionMotivo={proj.isError ? motivoSinProyeccion(proj.error) : null}
      cobranza={cob.data ?? null}
      pagos={ap.data ?? null}
      sinClasificar={sinClasificar}
      bancos={bancos}
      onPostpone={(payableId, days) =>
        postergar.mutateAsync({ payableId, days }).then(() => undefined)
      }
      hoy={hoy}
    />
  );
}

/* §5.4 — un estado de carga habla: qué se está trayendo y cuánto tarda. */
function CargandoCaja() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <p className="text-sm text-rediseno-tinta-3">
        Estamos trayendo tu saldo del banco y la proyección de caja (~5 s).
      </p>
      <div className="grid gap-3 sm:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-[14px] bg-rediseno-neutro-bg" />
        ))}
      </div>
      <div className="h-44 animate-pulse rounded-[14px] bg-rediseno-neutro-bg" aria-hidden="true" />
    </div>
  );
}
