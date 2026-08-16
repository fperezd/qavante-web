"use client";

import type { BankAccountItem } from "@/lib/api/treasury";
import { currencyByAccount, hasMixedCurrencies } from "@/components/caja/multi-currency";

/* Selector de cuenta bancaria para no MEZCLAR monedas (CLP vs USD) en las listas
   de movimientos. Regla: si el tenant tiene cuentas de >1 moneda, se DEBE elegir
   una (sin "Todas" — mezclar montos de distinta moneda engaña). Si todas las
   cuentas son de la misma moneda (o hay una sola), "Todas" es válido. Con una
   sola cuenta, no se renderiza (no hay nada que elegir).

   Los helpers puros (`currencyByAccount`, `hasMixedCurrencies`) viven en
   `@/components/caja/multi-currency`, junto al resto de la lógica INV-FX-001;
   se re-exportan acá para no romper los imports existentes. */
export { currencyByAccount, hasMixedCurrencies };

export interface BankAccountFilterProps {
  accounts: BankAccountItem[];
  /** id de la cuenta seleccionada; "" = todas. */
  value: string;
  onChange: (accountId: string) => void;
  /** Permitir "Todas" aunque haya monedas mezcladas. Úsalo en listas SIN total
   *  (cada fila se formatea en su moneda → no hay total que mezclar). Default
   *  false: con monedas mezcladas se obliga a elegir una cuenta (vistas con total). */
  allowAll?: boolean;
}

export function BankAccountFilter({
  accounts,
  value,
  onChange,
  allowAll = false,
}: BankAccountFilterProps) {
  if (accounts.length <= 1) return null;
  const showAll = allowAll || !hasMixedCurrencies(accounts);

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-neutral-mid">Cuenta</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Filtrar por cuenta bancaria"
        className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-neutral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      >
        {showAll && <option value="">Todas las cuentas</option>}
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} · {a.currency_code}
          </option>
        ))}
      </select>
    </label>
  );
}
