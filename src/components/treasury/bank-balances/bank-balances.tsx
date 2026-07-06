"use client";

import { QavanteInlineError } from "@/components/qavante";
import { useBiceSaldo } from "@/lib/api/treasury";
import { BankBalancesCard } from "./bank-balances-card";

/* Contenedor de la tarjeta de saldos: llama a `useBiceSaldo` y resuelve los
 * estados. Gated por el flag `bankBalances` en la página (Caja) — cuando está
 * OFF no se monta; cuando esté ON (tras cookie-gating de CC-API) aparece. */

export function BankBalances() {
  const query = useBiceSaldo();

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

  const cuentas = query.data?.cuentas ?? [];
  // Fecha de referencia = la más reciente entre las cuentas.
  const referencia = cuentas.reduce<string | null>(
    (acc, c) => (c.fechaHasta && (!acc || c.fechaHasta > acc) ? c.fechaHasta : acc),
    null,
  );

  return <BankBalancesCard cuentas={cuentas} referencia={referencia} />;
}
