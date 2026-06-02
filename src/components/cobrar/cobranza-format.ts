/* Helpers puros de la pantalla Cobrar (Sprint C4). SIN React → testeables.
   `parseAmount` se repite en gestion-format/cash-flow-format (string-decimal
   del backend → number); consolidación pendiente, se mantiene local para no
   acoplar dominios. */

import type { ReceivableAging } from "@/lib/api/cobranza";

export function parseAmount(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export interface AgingBar {
  key: keyof ReceivableAging;
  label: string;
  amount: number;
  /** % del total por cobrar (0 si total 0). */
  pct: number;
}

const AGING_ORDER: ReadonlyArray<keyof ReceivableAging> = [
  "current",
  "d1_30",
  "d31_60",
  "d61_90",
  "d90_plus",
];
const AGING_LABEL: Record<keyof ReceivableAging, string> = {
  current: "Vigente",
  d1_30: "1–30 días",
  d31_60: "31–60 días",
  d61_90: "61–90 días",
  d90_plus: "90+ días",
};

/** Tramos de antigüedad en orden, con monto + % del total (para barra apilada
 *  + tabla). El "vigente" no está vencido; el resto sí. */
export function agingBars(aging: ReceivableAging): AgingBar[] {
  const amounts = AGING_ORDER.map((k) => parseAmount(aging[k]));
  const total = amounts.reduce((a, b) => a + b, 0);
  return AGING_ORDER.map((k, i) => ({
    key: k,
    label: AGING_LABEL[k],
    amount: amounts[i]!,
    pct: total > 0 ? (amounts[i]! / total) * 100 : 0,
  }));
}
