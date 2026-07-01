/* Helpers PUROS de la Proyección de Caja v2 (saldo acumulado + quiebre).
 *
 * §17.4: el saldo acumulado es la suma progresiva de los `net` que YA entrega el
 * backend (ayuda visual de presentación, no un cálculo financiero nuevo). El
 * dato oficial de cada bucket sigue siendo del backend. Testeable sin UI. */

export interface ProjBucket {
  /** ISO "YYYY-MM-DD" (inicio del bucket) o "YYYY-MM". */
  period: string;
  /** Etiqueta corta ya lista (ej. "Sem 01-07"). */
  label: string;
  inflow: string;
  outflow: string;
  net: string;
}

export interface ProjRow extends ProjBucket {
  /** Saldo de caja al cierre del bucket (acumulado). */
  running: number;
  /** ¿El saldo de cierre queda bajo la caja mínima? */
  belowMinimum: boolean;
}

export function parseAmount(v: string | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Saldo acumulado bucket a bucket, partiendo del saldo inicial (CashToday). */
export function computeRunning(
  initialBalance: string,
  buckets: ProjBucket[],
  cashMinimum: string | null,
): ProjRow[] {
  const min = cashMinimum == null ? null : parseAmount(cashMinimum);
  let running = parseAmount(initialBalance);
  return buckets.map((b) => {
    running += parseAmount(b.net);
    return { ...b, running, belowMinimum: min != null && running < min };
  });
}

/** Índice del primer bucket donde la caja cruza bajo el mínimo (quiebre), o -1. */
export function firstBreachIndex(rows: ProjRow[]): number {
  return rows.findIndex((r) => r.belowMinimum);
}
