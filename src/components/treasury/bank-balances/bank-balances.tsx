"use client";

import { QavanteInlineError } from "@/components/qavante";
import { useBankAccounts, type BankAccountItem, type CuentaSaldo } from "@/lib/api/treasury";
import { BankBalancesCard } from "./bank-balances-card";

function cuentaDesdeTreasury(account: BankAccountItem): CuentaSaldo {
  return {
    numeroCuenta: account.id,
    numeroFormateado: account.name,
    nombreCuenta: `${account.bank_name} · ${account.name}`,
    moneda: account.currency_code,
    saldoContable: account.balance ?? null,
    saldoDisponible: account.balance ?? null,
    fechaHasta: account.balance_as_of?.slice(0, 10) ?? null,
    esExtranjera: (account.currency_code || "CLP").toUpperCase() !== "CLP",
  };
}

export function BankBalances() {
  const query = useBankAccounts();
  const cuentas = (query.data?.items ?? [])
    .filter((account) => account.account_type !== "credit_card")
    .map(cuentaDesdeTreasury);

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

  const referencia = cuentas.reduce<string | null>(
    (acc, c) => (c.fechaHasta && (!acc || c.fechaHasta > acc) ? c.fechaHasta : acc),
    null,
  );

  return <BankBalancesCard cuentas={cuentas} referencia={referencia} />;
}
