"use client";

import { QavanteInlineError } from "@/components/qavante";
import { useBiceSaldo, useBiceCuentasBalances } from "@/lib/api/treasury";
import { BankBalancesCard } from "./bank-balances-card";

/* Contenedor de la tarjeta de saldos: llama a `useBiceSaldo` (saldo por cuenta) y
 * `useBiceCuentasBalances` (el balance por cuenta, que trae la LÍNEA DE CRÉDITO).
 * Gated por el flag `bankBalances` en la página (Caja) — cuando está OFF no se
 * monta. `/api/bice/*` ya acepta cookie (CC-API lo migró a require_session,
 * sondeado 2026-08-03 → `no_session`), así que el flag ya puede encenderse. */

export function BankBalances() {
  const query = useBiceSaldo();
  const cuentas = query.data?.cuentas ?? [];
  // El balance por cuenta (con la LC) se pide sobre los tokens `numeroCuenta` del saldo. No bloquea el
  // render: la card muestra los saldos apenas llegan y la LC se agrega cuando responden los balances.
  const { balancePorCuenta } = useBiceCuentasBalances(
    cuentas.map((c) => c.numeroCuenta),
    cuentas.length > 0,
  );

  if (query.isLoading) {
    return (
      <div
        className="h-28 animate-pulse rounded-xl bg-neutral-light/30"
        aria-busy="true"
        aria-label="Consultando tus saldos de banco"
      />
    );
  }

  if (query.isError) {
    return <QavanteInlineError error={query.error} what="tus saldos de banco" />;
  }

  // Fecha de referencia = la más reciente entre las cuentas.
  const referencia = cuentas.reduce<string | null>(
    (acc, c) => (c.fechaHasta && (!acc || c.fechaHasta > acc) ? c.fechaHasta : acc),
    null,
  );

  return (
    <BankBalancesCard
      cuentas={cuentas}
      referencia={referencia}
      balancePorCuenta={balancePorCuenta}
    />
  );
}
