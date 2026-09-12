"use client";

import { useQueries } from "@tanstack/react-query";
import { useBiceSaldo, treasuryKeys, type CuentaBalanceResponse } from "@/lib/api/treasury";
import { api } from "@/lib/api/client";
import { formatMoney } from "@/lib/formatters/clp";
import { creditoInformado } from "./inicio-resumen-model";

/** BICE is the only existing detailed credit reader. Never label its subtotal as all banks. */
export function InicioCreditosLive({ enabled }: { enabled: boolean }) {
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
      ? [{ ...credit, id: account.numeroCuenta, account: account.numeroFormateado }]
      : [];
  });
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-background p-3 text-sm">
      <p className="text-xs text-neutral-mid">Líneas de crédito · BICE</p>
      {accounts.isLoading || balancesLoading ? (
        <p role="status">Consultando cupos…</p>
      ) : (
        lines.map((line) => <InicioCreditoLinea key={line.id} {...line} />)
      )}
      {accountsFailed || balancesFailed ? (
        <p className="text-xs text-warning-700">No se pudieron consultar todos los cupos.</p>
      ) : !accounts.isLoading && !balancesLoading && !lines.length ? (
        <p className="text-xs text-neutral-mid">Sin cupos informados.</p>
      ) : null}
    </div>
  );
}

export function InicioCreditoLinea({
  account,
  currency,
  available,
  total,
}: {
  account: string;
  currency: string;
  available: number | null;
  total: number;
}) {
  return (
    <div className="min-w-0">
      <p className="break-words text-xs text-neutral-mid">
        Cuenta {account} · {currency}
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
