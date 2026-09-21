"use client";

import { useBankAccounts } from "@/lib/api/treasury";
import { formatMoney } from "@/lib/formatters/clp";
import { parseAmountOrNull } from "@/lib/formatters/amount";

export function InicioCreditosLive({ enabled }: { enabled: boolean }) {
  return enabled ? <CreditosConectados /> : null;
}

function CreditosConectados() {
  const query = useBankAccounts();
  if (query.isLoading) {
    return (
      <div className="mt-4 space-y-3 rounded-xl bg-background p-3 text-sm">
        <p className="text-sm font-medium">Tarjetas y créditos</p>
        <p role="status">Consultando cuentas…</p>
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="mt-4 space-y-3 rounded-xl bg-background p-3 text-sm">
        <p className="text-sm font-medium">Tarjetas y créditos</p>
        <p className="text-xs text-warning-700">No se pudieron consultar las cuentas de crédito.</p>
      </div>
    );
  }
  const lines = (query.data?.items ?? [])
    .filter((account) => account.account_type === "credit_card" || account.account_type === "loan")
    .map((account) => ({
      id: account.id,
      bank: account.bank_name,
      account: account.name,
      currency: account.currency_code,
      available: parseAmountOrNull(account.balance),
      total: parseAmountOrNull(account.balance) ?? 0,
    }));
  return (
    <div className="mt-4 space-y-3 rounded-xl bg-background p-3 text-sm">
      <p className="text-sm font-medium">Tarjetas y créditos</p>
      {lines.length > 0 ? (
        <InicioCreditos lines={lines} />
      ) : (
        <p className="text-xs text-neutral-mid">Sin tarjetas ni créditos informados.</p>
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
  bank = "Banco",
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
        {bank} · {account} · {currency}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-3 text-sm tabular-nums">
        <div className="min-w-0">
          <dt className="text-xs text-neutral-mid">Saldo informado</dt>
          <dd className="mt-1 break-words font-medium">
            {available == null ? "Sin dato" : formatMoney(available, currency)}
          </dd>
        </div>
        <div className="min-w-0 border-l border-border pl-3">
          <dt className="text-xs text-neutral-mid">En la cuenta</dt>
          <dd className="mt-1 break-words">{formatMoney(total, currency)}</dd>
        </div>
      </dl>
    </div>
  );
}
