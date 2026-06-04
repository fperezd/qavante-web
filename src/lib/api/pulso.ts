import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { PulsoStatus } from "./dashboard";

/* Capa de datos — Pulso detalle (Sprint C6/C7, Documento Maestro §7, Anexo C).
   "¿Por qué está así mi Pulso?": el detalle del índice de salud que el dashboard
   muestra resumido. Score + estado + los ejes que lo componen + drivers (qué lo
   empuja arriba/abajo) + tendencia histórica.

   ⚠️ Contrato FE-FIRST. `GET /api/management/pulso` AÚN NO existe en el backend.
   Tipos hand-rolled como el contrato ESPERADO, documentado en
   `docs/backend-contracts/pulso-detail-contract.md` (handoff a CC-API).
   `generate:api` los reemplaza cuando el backend lo exponga (regla 3). Gated por
   `pulsoDetail` (OFF en prod).

   El cálculo del score, pesos y drivers es **lógica de negocio del backend** (NO
   FE — CLAUDE.md). El FE solo muestra. Montos string-decimal donde aplique. */

export type PulsoDirection = "positive" | "negative";
export type PulsoImpact = "high" | "medium" | "low";

export interface PulsoComponent {
  /** Identificador estable del eje (ej. "liquidity"). */
  key: string;
  /** Etiqueta legible (ej. "Liquidez"). */
  label: string;
  /** Sub-score del eje, 0–100. */
  score: number;
  /** Peso del eje en el índice total, 0–1. */
  weight: number;
}

export interface PulsoDriverDetail {
  /** Título corto del factor. */
  label: string;
  direction: PulsoDirection;
  impact: PulsoImpact;
  /** Explicación en lenguaje humano (rule-based, NO LLM). */
  detail: string;
  /** CTA opcional para actuar (ruta interna del FE). */
  cta_label: string | null;
  cta_href: string | null;
}

export interface PulsoTrendPoint {
  /** Período (ej. "2026-05"). */
  period: string;
  /** Score del período, 0–100. */
  score: number;
}

export interface PulsoDetailResponse {
  /** 0–100. */
  score: number;
  status: PulsoStatus;
  confidence: string;
  /** true si el cálculo está incompleto (faltan fuentes). */
  preliminary: boolean;
  /** Frase rule-based que resume el porqué; null si no se pudo generar. */
  headline: string | null;
  /** Ejes que componen el índice. Vacío si aún no hay desglose. */
  components: PulsoComponent[];
  /** Factores que empujan el Pulso. Vacío si no hay drivers. */
  drivers: PulsoDriverDetail[];
  /** Histórico del score (más reciente último). Vacío si no hay historia. */
  trend: PulsoTrendPoint[];
  generated_at: string;
}

export const pulsoKeys = {
  all: ["pulso"] as const,
  detail: () => [...pulsoKeys.all, "detail"] as const,
};

/** `GET /api/management/pulso` — detalle del Pulso Empresa. NO retry. */
export function usePulsoDetail() {
  return useQuery({
    queryKey: pulsoKeys.detail(),
    queryFn: () => api.get<PulsoDetailResponse>("/api/management/pulso"),
    staleTime: 30_000,
    retry: false,
  });
}
