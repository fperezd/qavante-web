/* Modelo PURO del widget "Saldos en banco" del Inicio (sin React → testeable). Lista el saldo
   por cuenta y el total en pesos (sin mezclar monedas). Fuente: treasury / Fintoc. */

import type { BankAccountItem, SaldoResponse } from "@/lib/api/treasury";
import { parseAmount } from "@/components/gestion/gestion-format";
import { parseAmountOrNull } from "@/lib/formatters/amount";

export interface CuentaBanco {
  nombre: string;
  numero: string;
  moneda: string;
  saldo: number;
  extranjera: boolean;
}

export interface SaldosBanco {
  cuentas: CuentaBanco[];
  /** Suma de las cuentas en pesos (no incluye extranjeras — no se mezclan monedas). */
  totalClp: number;
}

/** Deriva los saldos por cuenta desde treasury (Fintoc). `null` si no hay cuentas. */
export function saldosBancoDesdeCuentas(
  items: readonly BankAccountItem[] | undefined,
): SaldosBanco | null {
  const cuentas = (items ?? []).filter((account) => account.account_type !== "credit_card");
  if (!cuentas.length) return null;
  const mapped: CuentaBanco[] = cuentas.map((account) => {
    const moneda = (account.currency_code || "CLP").toUpperCase();
    return {
      nombre: `${account.bank_name} · ${account.name}`.trim(),
      numero: account.id,
      moneda,
      saldo: parseAmountOrNull(account.balance) ?? 0,
      extranjera: moneda !== "CLP",
    };
  });
  const totalClp = mapped.filter((c) => !c.extranjera).reduce((s, c) => s + c.saldo, 0);
  return { cuentas: mapped, totalClp };
}

/** @deprecated Shape del scrape legado; los tests de fixture lo conservan. */
export function saldosBanco(resp: SaldoResponse | undefined): SaldosBanco | null {
  const cuentas = resp?.cuentas;
  if (!cuentas?.length) return null;
  const mapped: CuentaBanco[] = cuentas.map((c) => ({
    nombre: c.nombreCuenta || c.numeroFormateado || c.numeroCuenta,
    numero: c.numeroFormateado || c.numeroCuenta,
    moneda: c.codigoMoneda || "CLP",
    saldo: parseAmount(c.saldoContable),
    extranjera: c.esExtranjera,
  }));
  const totalClp = mapped.filter((c) => !c.extranjera).reduce((s, c) => s + c.saldo, 0);
  return { cuentas: mapped, totalClp };
}
