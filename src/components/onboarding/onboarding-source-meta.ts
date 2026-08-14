/* Presentación de las fuentes conectables del wizard (labels, copys, estados).
   SIN React → testeable. La lógica de estado vive en el adaptador
   (`src/lib/api/onboarding-sources.ts`); acá solo cómo se le habla al usuario.

   Voice & Tone (Anexo F): nada de "tenant", nada de jerga técnica, y NUNCA
   presentar un estado desconocido como si fuera un hecho. */

import type { OnboardingSourceId, OnboardingSourceState } from "@/lib/api/onboarding-sources";

export interface OnboardingSourceMeta {
  id: OnboardingSourceId;
  /** Nombre visible de la fuente. */
  label: string;
  /** Qué gana el usuario al conectarla (una línea). */
  benefit: string;
  /** Qué se pierde mientras NO esté conectada — honesto, sin dramatizar. */
  missingConsequence: string;
}

export const ONBOARDING_SOURCE_META: Record<OnboardingSourceId, OnboardingSourceMeta> = {
  sii: {
    id: "sii",
    label: "SII",
    benefit: "Trae tus facturas, boletas e impuestos automáticamente.",
    missingConsequence: "Sin el SII no vemos tus ventas, compras ni impuestos.",
  },
  bank: {
    id: "bank",
    label: "Banco",
    benefit: "Trae tus movimientos para clasificarlos y proyectar tu caja.",
    missingConsequence: "Sin el banco no vemos tus movimientos ni tu saldo real.",
  },
};

/** Etiqueta corta del estado, para el badge. */
export const SOURCE_STATE_LABEL: Record<OnboardingSourceState, string> = {
  connected: "Conectada",
  deferred: "La conectas después",
  pending: "Sin conectar",
};

/** Variante del `QavanteBadge` por estado. `deferred` es informativo (no es un
    error: el usuario lo eligió); `pending` avisa sin alarmar. */
export const SOURCE_STATE_BADGE: Record<OnboardingSourceState, "success" | "info" | "warning"> = {
  connected: "success",
  deferred: "info",
  pending: "warning",
};

/** Frase de estado para el detalle bajo el nombre de la fuente. */
export function sourceStateDescription(
  id: OnboardingSourceId,
  state: OnboardingSourceState,
): string {
  const meta = ONBOARDING_SOURCE_META[id];
  if (state === "connected") return meta.benefit;
  if (state === "deferred") return `${meta.missingConsequence} Puedes conectarla cuando quieras.`;
  return meta.missingConsequence;
}

/** Copy del botón de acción según el estado. */
export function sourceActionLabel(state: OnboardingSourceState): string {
  return state === "connected" ? "Revisar conexión" : "Conectar ahora";
}
