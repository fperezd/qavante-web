"use client";

import { useQueries } from "@tanstack/react-query";
import {
  useBiceSaldo,
  useBankAccounts,
  treasuryKeys,
  type CuentaBalanceResponse,
} from "@/lib/api/treasury";
import { api } from "@/lib/api/client";
import { formatMoney } from "@/lib/formatters/clp";
import { creditoInformado } from "./inicio-resumen-model";

/** BICE is the only existing detailed credit reader. Never label its subtotal as all banks. */
export function InicioCreditosLive({ enabled }: { enabled: boolean }) {
  return enabled ? <CreditosConectados /> : null;
}

function CreditosConectados() {
  const enabled = true;
  const bankAccounts = useBankAccounts();
  const accounts = useBiceSaldo(enabled);
  const accountsFailed =
    accounts.isError || (!accounts.isLoading && accounts.data?.status !== "ok");
  const numbers = accountsFailed
    ? []
    : (accounts.data?.cuentas ?? []).map((account) => account.numeroCuenta);
  // Retain the response envelope: BICE can report functional errors with HTTP 200.
  const balances = useQueries({
    queries: numbers.map((account) => ({
      queryKey: treasuryKeys.biceCuentaBalance(account),
      queryFn: () =>
        api.get<CuentaBalanceResponse>(`/api/bice/cuentas/${encodeURIComponent(account)}/balance`, {
          skipAuthRetry: true,
        }),
      enabled: enabled && account !== "",
      staleTime: 5 * 60 * 1000,
      retry: false,
    })),
  });
  const balancesLoading = balances.some((balance) => balance.isLoading);
  const balancesFailed = balances.some(
    (balance) =>
      balance.isError ||
      (!balance.isLoading && (balance.data?.status !== "ok" || !balance.data.data)),
  );
  if (!enabled) return null;
  const lines = (accountsFailed ? [] : (accounts.data?.cuentas ?? [])).flatMap((account, index) => {
    const response = balances[index];
    const credit = creditoInformado(
      !response?.isError && response?.data?.status === "ok"
        ? (response.data.data ?? undefined)
        : undefined,
    );
    return credit
      ? [{ ...credit, id: account.numeroCuenta, bank: "BICE", account: account.numeroFormateado }]
      : [];
  });
  const otherBanks = [
    ...new Set(
      (bankAccounts.isError ? [] : (bankAccounts.data?.items ?? []))
        .filter((a) => a.active && ["checking", "savings"].includes(a.account_type))
        .map((a) => a.bank_name.trim())
        .filter((name) => name && !/^(banco\s+)?bice$/i.test(name)),
    ),
  ];
  return (
    <div className="mt-4 space-y-3 rounded-xl bg-background p-3 text-sm">
      <p className="text-sm font-medium">Líneas de crédito</p>
      {accounts.isLoading || balancesLoading ? (
        <p role="status">Consultando cupos…</p>
      ) : (
        <InicioCreditos lines={lines} />
      )}
      {accountsFailed || balancesFailed ? (
        <p className="text-xs text-warning-700">No se pudieron consultar todos los cupos.</p>
      ) : !accounts.isLoading && !balancesLoading && !lines.length ? (
        <p className="text-xs text-neutral-mid">BICE: sin cupos informados.</p>
      ) : null}
      <p className="text-xs text-neutral-mid">Cupos consultados: BICE.</p>
      {otherBanks.length > 0 && (
        <p className="text-xs text-neutral-mid">
          {otherBanks.join(", ")}: información de cupos no disponible.
        </p>
      )}
    </div>
  );
}

export interface InicioCredito {
  id: string;
  bank: string;
  account: string;
  currency: string;
  available: number | null;
  total: number;
}

/** One row per bank/account/currency, never a combined cross-currency credit total. */
export function InicioCreditos({ lines }: { lines: readonly InicioCredito[] }) {
  const first = lines[0];
  if (!first) return null;
  return (
    <div className="space-y-3">
      <InicioCreditoLinea {...first} />
      {lines.length > 1 && (
        <details>
          <summary className="min-h-11 cursor-pointer content-center rounded-md text-xs text-brand-primary focus-visible:outline-2 focus-visible:outline-brand-primary">
            Ver todas las líneas ({lines.length})
          </summary>
          <div className="space-y-3 border-t border-border pt-3">
            {lines.slice(1).map((line) => (
              <InicioCreditoLinea key={[line.bank, line.id, line.currency].join("|")} {...line} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export function InicioCreditoLinea({
  bank = "BICE",
  account,
  currency,
  available,
  total,
}: {
  bank?: string;
  account: string;
  currency: string;
  available: number | null;
  total: number;
}) {
  return (
    <div className="min-w-0">
      <p className="break-words text-xs text-neutral-mid">
        {bank} · Cuenta {account} · {currency}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-3 text-sm tabular-nums">
        <div className="min-w-0">
          <dt className="text-xs text-neutral-mid">Disponible</dt>
          <dd className="mt-1 break-words font-medium">
            {available == null ? "Sin dato" : formatMoney(available, currency)}
          </dd>
        </div>
        <div className="min-w-0 border-l border-border pl-3">
          <dt className="text-xs text-neutral-mid">Cupo total</dt>
          <dd className="mt-1 break-words">{formatMoney(total, currency)}</dd>
        </div>
      </dl>
    </div>
  );
}
