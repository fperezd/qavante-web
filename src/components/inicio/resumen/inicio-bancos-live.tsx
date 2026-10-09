"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown, Clock3, Landmark } from "lucide-react";
import { BankLogo } from "@/components/banco/bank-logo";
import { canonicalBankId } from "@/lib/banco/bank-assets";
import { useBankAccounts, type BankAccountItem } from "@/lib/api/treasury";
import { formatMoney } from "@/lib/formatters/clp";
import { formatDateLong } from "@/lib/formatters/date";
import { parseAmountOrNull } from "@/lib/formatters/amount";
import { cn } from "@/lib/utils";
import { bancosInicio, fechaSaldoSantiago } from "./inicio-bancos-model";

function SaldosPorCuentaDetails({
  accounts,
  className,
}: {
  accounts: readonly BankAccountItem[];
  className?: string;
}) {
  return (
    <details className={cn("group/bancos", className)}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-brand-primary focus-visible:outline-2 focus-visible:outline-brand-primary [&::-webkit-details-marker]:hidden">
        Ver saldos por cuenta y fecha
        <ChevronDown
          className="h-4 w-4 shrink-0 transition-transform group-open/bancos:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <ul className="space-y-4 border-t border-border pt-3">
        {accounts.map((a) => {
          const amount = parseAmountOrNull(a.balance);
          const bankLabel = a.bank_name || "Banco no informado";
          const bankId = canonicalBankId("", bankLabel);
          return (
            <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium">
                  {bankLabel} · {a.name}
                </p>
                <p className="mt-1 tabular-nums">
                  {amount == null || !a.currency_code.trim()
                    ? "Sin dato"
                    : formatMoney(amount, a.currency_code)}{" "}
                  · {a.currency_code}
                </p>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-neutral-mid">
                  {a.account_number_display && (
                    <span className="shrink-0 font-mono tracking-wide">
                      {a.account_number_display}
                    </span>
                  )}
                  <span>
                    Fecha del saldo:{" "}
                    {fechaSaldoSantiago(a.balance_as_of)
                      ? formatDateLong(fechaSaldoSantiago(a.balance_as_of))
                      : "sin fecha informada"}
                  </span>
                </p>
              </div>
              <BankLogo
                institutionId={bankId}
                name={bankLabel}
                size="sm"
                className="shrink-0 rounded-none"
              />
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export function InicioBancosLive({ actualizadoLabel }: { actualizadoLabel?: string } = {}) {
  const query = useBankAccounts();
  if (query.isLoading)
    return (
      <p className="text-sm text-neutral-mid" role="status">
        Consultando saldos por cuenta…
      </p>
    );
  if (query.isError || !query.data)
    return (
      <div>
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
  return (
    <InicioBancos
      accounts={query.data.items ?? []}
      layout="inicio-maqueta"
      actualizadoLabel={actualizadoLabel}
    />
  );
}

export function InicioBancos({
  accounts,
  now = new Date(),
  layout = "default",
  actualizadoLabel,
}: {
  accounts: readonly BankAccountItem[];
  now?: Date;
  layout?: "default" | "inicio-maqueta";
  /** Línea de frescura (p. ej. del crumb de inicio). */
  actualizadoLabel?: string;
}) {
  const bank = bancosInicio(accounts);
  const civilDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" });
  const hasOldBalance = bank.accounts.some((a) => {
    const day = fechaSaldoSantiago(a.balance_as_of);
    return !day || day !== civilDay.format(now);
  });
  const maqueta = layout === "inicio-maqueta";
  const cuentasLabel =
    bank.accounts.length > 0
      ? `${bank.bankCount} ${bank.bankCount === 1 ? "banco" : "bancos"} · ${bank.accounts.length} ${bank.accounts.length === 1 ? "cuenta" : "cuentas"}`
      : null;

  return (
    <div className={cn(maqueta ? "flex min-h-0 flex-1 flex-col" : "mt-5")}>
      <div className={cn(maqueta ? "flex flex-col gap-2.5" : "space-y-3")}>
        <div className={cn(maqueta ? "flex flex-wrap items-baseline gap-x-8 gap-y-3" : undefined)}>
          {bank.currencies.map((row, index) => (
            <div key={row.currency} className={cn(maqueta && "min-w-0")}>
              <p
                className={cn(
                  maqueta ? "text-xs font-medium text-neutral-mid" : "text-xs text-neutral-mid",
                )}
              >
                {row.currency}
                {row.partial && " · Subtotal informado"}
              </p>
              <p
                className={cn(
                  "break-words font-bold tabular-nums text-neutral-dark",
                  maqueta
                    ? cn("mt-0.5", index === 0 ? "text-4xl tracking-tight" : "text-2xl")
                    : "mt-1 text-3xl font-semibold tracking-tight",
                )}
              >
                {row.total == null ? "Sin dato" : formatMoney(row.total, row.currency)}
              </p>
            </div>
          ))}
        </div>
        {maqueta && (bank.missing.length > 0 || hasOldBalance) && (
          <div className="space-y-1">
            {bank.missing.length > 0 && (
              <p className="text-xs text-warning-700">Hay cuentas sin saldo o moneda informados.</p>
            )}
            {hasOldBalance && (
              <p className="text-xs text-warning-700">Hay saldos sin actualización de hoy.</p>
            )}
          </div>
        )}
      </div>
      {!bank.accounts.length && (
        <p className="text-sm text-neutral-mid">Sin cuentas bancarias informadas.</p>
      )}
      {!maqueta && bank.accounts.length > 0 && (
        <p className="mt-3 text-xs text-neutral-mid">{cuentasLabel}</p>
      )}
      {!maqueta && bank.missing.length > 0 && (
        <p className="mt-2 text-xs text-warning-700">Hay cuentas sin saldo o moneda informados.</p>
      )}
      {!maqueta && hasOldBalance && (
        <p className="mt-2 text-xs text-warning-700">Hay saldos sin actualización de hoy.</p>
      )}
      {bank.accounts.length > 0 &&
        (maqueta ? (
          <div className="mt-auto">
            <SaldosPorCuentaDetails accounts={bank.accounts} />
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-3">
              <Link
                href="/banco"
                className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-semibold text-brand-primary hover:underline"
              >
                Ver cuentas y composición <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-sm text-neutral-mid">
                {actualizadoLabel && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {actualizadoLabel}
                  </span>
                )}
                {cuentasLabel && (
                  <span className="inline-flex items-center gap-1.5">
                    <Landmark className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {cuentasLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <SaldosPorCuentaDetails accounts={bank.accounts} className="mt-1" />
        ))}
    </div>
  );
}
