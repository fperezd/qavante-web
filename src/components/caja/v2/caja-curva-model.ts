/* Modelo PURO de la curva de saldo proyectado del Caja v2 (sin React → testeable).
   Deriva el SALDO ACUMULADO a partir del saldo de hoy + los netos por período, y
   detecta cuándo la caja cruza el mínimo y su punto más bajo.

   Por qué se deriva en el FE: el reporte de caja del backend
   (`GET /api/treasury/reports/cash-flow`) hoy trae entrada/salida/neto por bucket, pero
   NO `running_balance` ni `min_cash` (brecha abierta en el canal con CC-API). Con el
   saldo de hoy (de bank-balances / dashboard) + los netos por bucket, el FE arma la
   curva. Si el backend los manda, se usan directo (más exacto en multi-cuenta). */

export interface SaldoPunto {
  /** Etiqueta del período (ej. "14–20 jul" o "11-ago"). */
  label: string;
  /** Saldo proyectado al cierre del período. */
  saldo: number;
}

/** Saldo acumulado por período: `saldo[i] = saldoInicial + Σ netos[0..i]`. */
export function saldoAcumulado(saldoInicial: number, netos: number[]): number[] {
  const out: number[] = [];
  let acc = saldoInicial;
  for (const n of netos) {
    acc += Number.isFinite(n) ? n : 0;
    out.push(acc);
  }
  return out;
}

/** Índice del PRIMER período en que el saldo cae ESTRICTAMENTE bajo el mínimo, o `null`
 *  si nunca lo cruza. Es "cuándo la caja toca el piso". */
export function primerCruce(saldos: number[], minimo: number): number | null {
  const i = saldos.findIndex((s) => s < minimo);
  return i === -1 ? null : i;
}

/** Índice del saldo más bajo de la serie, o `null` si está vacía. Empate → el primero. */
export function indiceMasBajo(saldos: number[]): number | null {
  if (saldos.length === 0) return null;
  let idx = 0;
  for (let i = 1; i < saldos.length; i++) {
    if ((saldos[i] as number) < (saldos[idx] as number)) idx = i;
  }
  return idx;
}
