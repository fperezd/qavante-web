"use client";

import * as React from "react";
import { Landmark, RefreshCw } from "lucide-react";
import { QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import { useBankAccounts, type BankAccountItem } from "@/lib/api/treasury";
import { BancoBankCard } from "./banco-bank-card";
import type { CuentaSaldo, TarjetaCredito } from "@/lib/api/treasury";

function cuentaDesdeTreasury(account: BankAccountItem): CuentaSaldo {
  return {
    numeroCuenta: account.id,
    numeroFormateado: account.name,
    nombreCuenta: account.name,
    moneda: account.currency_code,
    saldoContable: account.balance ?? null,
    saldoDisponible: account.balance ?? null,
    fechaHasta: account.balance_as_of?.slice(0, 10) ?? null,
    esExtranjera: (account.currency_code || "CLP").toUpperCase() !== "CLP",
  };
}

function tarjetaDesdeTreasury(account: BankAccountItem): TarjetaCredito {
  return {
    operationNumber: account.id,
    product: account.name,
    holder: account.bank_name,
    isActive: account.active,
  };
}

export function BancoView() {
  const query = useBankAccounts(true);
  const items = query.data?.items ?? [];
  const checking = items.filter((account) => account.account_type !== "credit_card");
  const cards = items.filter((account) => account.account_type === "credit_card");

  if (query.isError) {
    return <QavanteInlineError error={query.error} what="tus productos de banco" />;
  }

  if (!query.isLoading && items.length === 0) {
    return (
      <QavanteEmpty
        icon={Landmark}
        title="No hay bancos conectados"
        description="Conecta un banco con Fintoc. Van a aparecer acá con saldos y movimientos."
      />
    );
  }

  const byBank = new Map<string, BankAccountItem[]>();
  for (const account of items) {
    const key = account.bank_name.trim() || "Banco";
    const list = byBank.get(key) ?? [];
    list.push(account);
    byBank.set(key, list);
  }

  const horaTexto =
    query.dataUpdatedAt > 0
      ? new Date(query.dataUpdatedAt).toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-neutral-mid" aria-live="polite">
        {query.isFetching ? (
          <span className="inline-flex items-center gap-1.5 text-info-700">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Actualizando saldos…
          </span>
        ) : horaTexto ? (
          <span>Actualizado a las {horaTexto}</span>
        ) : null}
      </div>
      {[...byBank.entries()].map(([banco, accounts]) => {
        const cuentas = accounts
          .filter((account) => account.account_type !== "credit_card")
          .map((account) => ({ cuenta: cuentaDesdeTreasury(account) }));
        const tarjetas = accounts
          .filter((account) => account.account_type === "credit_card")
          .map((account) => ({ tarjeta: tarjetaDesdeTreasury(account), cupos: [] }));
        const referencia = accounts.reduce<string | null>((acc, account) => {
          const day = account.balance_as_of?.slice(0, 10) ?? null;
          return day && (!acc || day > acc) ? day : acc;
        }, null);
        return (
          <BancoBankCard
            key={banco}
            banco={banco}
            referencia={referencia}
            cuentas={cuentas}
            tarjetas={tarjetas}
            cuentasLoading={query.isLoading && checking.length === 0}
            tarjetasLoading={query.isLoading && cards.length === 0}
          />
        );
      })}
    </div>
  );
}
