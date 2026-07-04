"use client";

import { formatClp } from "@/lib/formatters/clp";
import { useCountUp } from "@/lib/hooks/use-count-up";

/* Monto en CLP que "cuenta" desde 0 al aparecer (nivel dios: las cifras cobran
   vida, no aparecen de golpe). Respeta prefers-reduced-motion vía el hook (salta
   al valor final). Pensado para las cifras héroe/KPIs. */
export interface AmountCountUpProps {
  value: number;
  /** Duración de la animación en ms (default 1100). */
  durationMs?: number;
}

export function AmountCountUp({ value, durationMs = 1100 }: AmountCountUpProps) {
  const n = useCountUp(value, durationMs);
  return <>{formatClp(Math.round(n))}</>;
}
