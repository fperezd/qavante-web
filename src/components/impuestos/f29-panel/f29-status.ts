/* Semáforo de una declaración F29 — lógica PURA (presentación, no cálculo
 * financiero: solo deriva el color de campos que el backend ya entregó).
 *
 *   🟢 success  — pagada / postergada (al día)
 *   🟡 warning  — con observaciones / pago parcial
 *   🔴 danger   — no pagada y ya venció, o no declarada y ya venció
 *   ⚪ neutral  — pendiente / futura (aún no vence)
 *
 * Testeable sin UI (ver f29-status.test.ts). */

import type { F29Declaracion } from "./types";

export type F29Tone = "success" | "warning" | "danger" | "neutral";

export interface F29StatusInfo {
  tone: F29Tone;
  /** Label corto para el badge. */
  label: string;
}

/** ¿La fecha de vencimiento ya pasó respecto de `now`? Compara por día
 *  (fecha_vencimiento es YYYY-MM-DD, sin hora). */
function estaVencida(fechaVencimiento: string, now: Date): boolean {
  // Comparación lexicográfica de YYYY-MM-DD contra hoy en el mismo formato:
  // es correcta porque ambos son ISO de ancho fijo.
  const hoy = now.toISOString().slice(0, 10);
  return fechaVencimiento < hoy;
}

export function f29Status(d: F29Declaracion, now: Date = new Date()): F29StatusInfo {
  const vencida = estaVencida(d.fecha_vencimiento, now);

  // 1) No declarada: rojo solo si ya venció el plazo; si no, "por declarar".
  if (d.estado === "no_declarada") {
    return vencida
      ? { tone: "danger", label: "No declarada" }
      : { tone: "neutral", label: "Por declarar" };
  }

  // 2) Con observaciones del SII → amarillo, más allá del pago.
  if (d.estado === "con_observaciones") {
    return { tone: "warning", label: "Con observaciones" };
  }

  // 3) Estado de pago.
  switch (d.estado_pago) {
    case "pagado":
      return { tone: "success", label: "Pagada" };
    case "postergado":
      return { tone: "success", label: "Postergada" };
    case "parcial":
      return { tone: "warning", label: "Pago parcial" };
    case "vencido":
      return { tone: "danger", label: "Vencida impaga" };
    case "pendiente":
      return vencida
        ? { tone: "danger", label: "Vencida impaga" }
        : { tone: "neutral", label: "Pendiente" };
  }
}

/** Punto/dot de color para el semáforo. */
export const TONE_DOT: Record<F29Tone, string> = {
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
  neutral: "bg-neutral-mid",
};

/** Variante de QavanteBadge equivalente al tono (neutral → "default"). */
export const TONE_BADGE: Record<F29Tone, "success" | "warning" | "danger" | "default"> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  neutral: "default",
};
