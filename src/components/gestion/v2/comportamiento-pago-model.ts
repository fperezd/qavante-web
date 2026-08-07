/* Modelo PURO del insight "comportamiento de pago" (sin React → testeable). Traduce el
   `behavior_shift_days` agregado de `collection-projection` (cuántos días, en promedio ponderado por
   monto, pagan tus clientes respecto del vencimiento nominal) a lenguaje de dueño.

   HONESTO: es un promedio GLOBAL de COBROS (no por contraparte — eso es brecha de CC-API, qavante-api
   #858). Si el backend no trae `behavior_shift_days` (null, sin comparables) → no hay insight (no se
   inventa un desfase). La cobertura (cuántas facturas tienen historial de pago) se muestra siempre. */

export interface ComportamientoPagoInput {
  vs_nominal?: {
    behavior_shift_days?: number | null;
    docs_comportamiento?: number | null;
    docs_por_vencimiento?: number | null;
  } | null;
}

export type ComportamientoTono = "danger" | "warning" | "success" | "neutral";

export interface ComportamientoPagoInsight {
  /** Días de desfase redondeados (+ = pagan después del vencimiento). */
  shiftDias: number;
  /** `true` si pagan después del vencimiento (shift > 0). */
  tarde: boolean;
  titulo: string;
  tono: ComportamientoTono;
  /** Facturas con historial de pago / total fechadas (para la cobertura honesta). */
  conHistorial: number;
  total: number;
}

/** Deriva el insight del `collection-projection`. `null` si no hay `behavior_shift_days`
 *  (sin comparables → no se muestra nada). */
export function comportamientoPagoInsight(
  proj: ComportamientoPagoInput | undefined | null,
): ComportamientoPagoInsight | null {
  const vs = proj?.vs_nominal;
  const raw = vs?.behavior_shift_days;
  if (raw == null || !Number.isFinite(raw)) return null;

  const shiftDias = Math.round(raw);
  const conHistorial = Math.max(0, vs?.docs_comportamiento ?? 0);
  const total = conHistorial + Math.max(0, vs?.docs_por_vencimiento ?? 0);

  const abs = Math.abs(shiftDias);
  if (shiftDias <= 0) {
    return {
      shiftDias,
      tarde: false,
      titulo:
        shiftDias === 0
          ? "Tus clientes pagan justo al vencimiento, en promedio"
          : `Tus clientes pagan ${abs} ${dia(abs)} antes del vencimiento, en promedio`,
      tono: "success",
      conHistorial,
      total,
    };
  }
  // Pagan tarde: severidad por magnitud (heurística de presentación, no de negocio).
  const tono: ComportamientoTono =
    shiftDias >= 15 ? "danger" : shiftDias >= 7 ? "warning" : "neutral";
  return {
    shiftDias,
    tarde: true,
    titulo: `Tus clientes te pagan ${abs} ${dia(abs)} después del vencimiento, en promedio`,
    tono,
    conHistorial,
    total,
  };
}

function dia(n: number): string {
  return n === 1 ? "día" : "días";
}
