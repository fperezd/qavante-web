"use client";

import { useBankAccounts, type BankAccountItem } from "@/lib/api/treasury";
import { formatMoney } from "@/lib/formatters/clp";
import { formatDateLong } from "@/lib/formatters/date";
import { parseAmountOrNull } from "@/lib/formatters/amount";
import { bancosInicio, fechaSaldoSantiago } from "./inicio-bancos-model";

export function InicioBancosLive() {
  const query = useBankAccounts();
  if (query.isLoading)
    return (
      <p className="mt-4 text-sm text-neutral-mid" role="status">
        Consultando saldos por cuenta…
      </p>
    );
  if (query.isError || !query.data)
    return (
      <div className="mt-4">
        <p className="text-sm text-warning-700">No se pudieron consultar los saldos por cuenta.</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="min-h-11 text-sm text-brand-primary"
        >
          Reintentar
        </button>
      </div>
    );
  return <InicioBancos accounts={query.data.items ?? []} />;
}

export function InicioBancos({
  accounts,
  now = new Date(),
}: {
  accounts: readonly BankAccountItem[];
  now?: Date;
}) {
  const bank = bancosInicio(accounts);
  const civilDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" });
  const hasOldBalance = bank.accounts.some((a) => {
    const day = fechaSaldoSantiago(a.balance_as_of);
    return !day || day !== civilDay.format(now);
  });
  return (
    <div className="mt-5">
      <div className="space-y-3">
        {bank.currencies.map((row) => (
          <div key={row.currency}>
            <p className="text-xs text-neutral-mid">
              {row.currency}
              {row.partial && " · Subtotal informado"}
            </p>
            <p className="mt-1 break-words text-3xl font-semibold tracking-tight tabular-nums">
              {row.total == null ? "Sin dato" : formatMoney(row.total, row.currency)}
            </p>
          </div>
        ))}
      </div>
      {!bank.accounts.length && (
        <p className="text-sm text-neutral-mid">Sin cuentas bancarias informadas.</p>
      )}
      {bank.accounts.length > 0 && (
        <p className="mt-3 text-xs text-neutral-mid">
          {bank.bankCount} {bank.bankCount === 1 ? "banco" : "bancos"} · {bank.accounts.length}{" "}
          {bank.accounts.length === 1 ? "cuenta" : "cuentas"}
        </p>
      )}
      {bank.missing.length > 0 && (
        <p className="mt-2 text-xs text-warning-700">Hay cuentas sin saldo o moneda informados.</p>
      )}
      {hasOldBalance && (
        <p className="mt-2 text-xs text-warning-700">Hay saldos sin actualización de hoy.</p>
      )}
      {bank.accounts.length > 0 && (
        <details className="mt-1 group/bancos">
          <summary className="min-h-11 cursor-pointer content-center rounded-md text-xs text-brand-primary focus-visible:outline-2 focus-visible:outline-brand-primary">
            Ver saldos por cuenta y fecha
          </summary>
          <ul className="space-y-3 border-t border-border pt-3">
            {bank.accounts.map((a) => {
              const amount = parseAmountOrNull(a.balance);
              return (
                <li key={a.id} className="text-sm">
                  <p className="break-words font-medium">
                    {a.bank_name || "Banco no informado"} · {a.name}
                  </p>
                  <p className="mt-1 tabular-nums">
                    {amount == null || !a.currency_code.trim()
                      ? "Sin dato"
                      : formatMoney(amount, a.currency_code)}{" "}
                    · {a.currency_code}
                  </p>
                  <p className="mt-1 text-xs text-neutral-mid">
                    Fecha del saldo:{" "}
                    {fechaSaldoSantiago(a.balance_as_of)
                      ? formatDateLong(fechaSaldoSantiago(a.balance_as_of))
                      : "sin fecha informada"}
                  </p>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}
