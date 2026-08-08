/* Modelo PURO del widget "Saldos en banco" del Inicio (sin React → testeable). Lista el saldo contable
   por cuenta y el total en pesos (sin mezclar monedas: las extranjeras se listan pero no se suman al
   total CLP). Fuente: /api/bice/saldo. */

import type { SaldoResponse } from "@/lib/api/treasury";
import { parseAmount } from "@/components/gestion/gestion-format";

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

/** Deriva los saldos por cuenta desde `/api/bice/saldo`. `null` si no hay cuentas. */
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
