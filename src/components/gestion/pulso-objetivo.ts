/* Lógica PURA del "objetivo del Pulso" (sin React → testeable). El dueño elige QUÉ prioriza su
   empresa y eso re-pondera los ejes del Pulso. El re-ponderado del score lo hace CC-API (regla del
   repo: el FE NO calcula Pulso); el FE captura el objetivo, lo manda al endpoint (`?objetivo=`) y
   muestra lo que el backend devuelve. El objetivo se persiste en el blob de prefs de UI
   (`GET/PUT /api/me/preferences`, #571) — mismo molde que `widget-order.ts` ("reemplaza, no merge"). */

import type { PreferencesBlob } from "@/lib/api/preferences";

/** Objetivo del negocio con el que se mira la salud. El backend define cómo re-pondera cada uno. */
export type PulsoObjetivo = "equilibrado" | "cuidar_caja" | "cumplir_pagos" | "crecer";

export const DEFAULT_OBJETIVO: PulsoObjetivo = "equilibrado";

/** Clave estable del objetivo dentro del blob de prefs. */
export const PULSO_OBJETIVO_KEY = "pulso_objetivo";

export interface PulsoObjetivoOption {
  key: PulsoObjetivo;
  label: string;
  /** Una línea de qué prioriza (lenguaje de dueño). */
  descripcion: string;
}

/* El menú de objetivos (el contrato de keys es compartido con CC-API). Orden: el balance primero,
   luego los focos. "Crecer" recién muerde cuando el Pulso sume ejes de ingresos/margen (hoy es
   caja); hasta entonces el backend lo trata como equilibrado (sin número falso). */
export const PULSO_OBJETIVOS: PulsoObjetivoOption[] = [
  {
    key: "equilibrado",
    label: "Equilibrado",
    descripcion: "La mirada por defecto: todos los factores pesan parejo.",
  },
  {
    key: "cuidar_caja",
    label: "Cuidar la caja",
    descripcion: "Prioriza tus días de caja y la holgura para no quedar corto.",
  },
  {
    key: "cumplir_pagos",
    label: "Cumplir los pagos",
    descripcion: "Prioriza cubrir tus obligaciones del mes.",
  },
  {
    key: "crecer",
    label: "Crecer",
    descripcion: "Prioriza la fuerza y la tendencia de tus ingresos.",
  },
];

const OBJETIVO_KEYS = new Set<string>(PULSO_OBJETIVOS.map((o) => o.key));

/** `true` si `v` es un objetivo conocido (defensa contra deriva del blob). */
export function isPulsoObjetivo(v: unknown): v is PulsoObjetivo {
  return typeof v === "string" && OBJETIVO_KEYS.has(v);
}

/** La opción (label/descripcion) de un objetivo. Cae al default si no matchea. */
export function objetivoOption(key: PulsoObjetivo): PulsoObjetivoOption {
  return PULSO_OBJETIVOS.find((o) => o.key === key) ?? PULSO_OBJETIVOS[0]!;
}

/** Lee el objetivo guardado del blob. Defensivo: cualquier valor desconocido → el default. */
export function readPulsoObjetivo(blob: PreferencesBlob | undefined): PulsoObjetivo {
  const v = blob?.[PULSO_OBJETIVO_KEY];
  return isPulsoObjetivo(v) ? v : DEFAULT_OBJETIVO;
}

/** Blob COMPLETO con el objetivo actualizado (respeta "reemplaza, no merge": preserva el resto). */
export function withPulsoObjetivo(
  blob: PreferencesBlob | undefined,
  objetivo: PulsoObjetivo,
): PreferencesBlob {
  return { ...(blob ?? {}), [PULSO_OBJETIVO_KEY]: objetivo };
}
