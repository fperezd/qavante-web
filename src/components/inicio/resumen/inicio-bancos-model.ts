import type { BankAccountItem } from "@/lib/api/treasury";
import { sumaPorMoneda } from "@/components/banco/v03/banco-v03-model";
import { parseAmountOrNull } from "@/lib/formatters/amount";

/** Timestamp and date-only bank responses share one civil day for display and freshness. */
export function fechaSaldoSantiago(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const date = new Date(raw);
  if (!Number.isFinite(date.valueOf())) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return date.toISOString().slice(0, 10) === raw ? raw : null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(date);
}

/** Aggregate only the server-owned balances in their own currency; never forecast or FX. */
export function bancosInicio(items: readonly BankAccountItem[]) {
  const accounts = [
    ...new Map(
      items
        .filter((a) => a.active && ["checking", "savings"].includes(a.account_type))
        .map((a) => [a.id, a]),
    ).values(),
  ];
  const { porMoneda } = sumaPorMoneda(
    accounts
      .filter((a) => a.currency_code.trim())
      .map((a) => ({
        key: a.id,
        nombre: a.name,
        sub: "",
        moneda: a.currency_code.trim().toUpperCase(),
        saldo: parseAmountOrNull(a.balance),
        saldoMotivo: null,
        href: null,
        accion: "",
        porConciliar: null,
        tipo: "cuenta" as const,
      })),
  );
  const missing = accounts.filter(
    (a) => !a.currency_code.trim() || parseAmountOrNull(a.balance) == null,
  );
  return {
    accounts,
    bankCount: new Set(accounts.map((a) => a.bank_name.trim().toLocaleLowerCase()).filter(Boolean))
      .size,
    missing,
    currencies: [
      ...new Set(accounts.map((a) => a.currency_code.trim().toUpperCase()).filter(Boolean)),
    ]
      .sort()
      .map((currency) => ({
        currency,
        total: porMoneda.find((g) => g.moneda === currency)?.total ?? null,
        partial: missing.some((a) => a.currency_code.trim().toUpperCase() === currency),
      })),
  };
}
