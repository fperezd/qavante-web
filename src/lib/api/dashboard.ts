import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

/* Capa de datos — Inicio Ejecutivo / Dashboard (Sprint C8, Documento Maestro
   §7.1).

   ⚠️ Contrato FE-FIRST. `GET /api/dashboard/summary` AÚN NO existe en el
   backend. Tipos hand-rolled como el contrato ESPERADO, documentado en
   `docs/backend-contracts/inicio-dashboard-summary-contract.md` (handoff a
   CC-API). `generate:api` los reemplaza cuando el backend lo exponga (regla 3).
   Gated por `dashboardSummary` (OFF en prod) → no corre en prod.

   Cada bloque es NULLABLE: una fuente puede faltar/fallar sin tumbar el
   dashboard (Maestro §7.1: "carga aunque una fuente falle"; faltante ≠ 0).
   La frase ejecutiva es rule-based (NO LLM, Anexo H.1). Montos string-decimal. */

export type Confidence = "high" | "medium" | "low";
export type PulsoStatus = "critical" | "weak" | "stable" | "strong";

export interface DashboardPulso {
  /** 0–100. */
  score: number;
  status: PulsoStatus;
  confidence: Confidence;
  top_driver_positive: string | null;
  top_driver_negative: string | null;
  /** "preliminar" si el cálculo está incompleto (faltan fuentes). */
  preliminary: boolean;
}

export interface DashboardCashToday {
  total: string;
  /** Frescura del dato (ISO date-time). */
  last_updated: string;
  data_state: "available" | "stale" | "estimated";
}

export interface DashboardCashForecast {
  /** Caja mínima esperada en 14 / 30 días. */
  min_14d: string;
  min_30d: string;
  /** Días estimados de caja (runway); null si no se pudo calcular. */
  days_of_cash: number | null;
}

export interface DashboardCashGap {
  critical_obligations_14d: string;
  projected_cash_14d: string;
  /** true si las obligaciones críticas a 14d superan la caja proyectada. */
  has_gap: boolean;
}

export interface DashboardOverdueCollections {
  total_receivable: string;
  overdue: string;
  /** Top 3 clientes por saldo. */
  top_clients: Array<{ name: string; amount: string }>;
}

export interface DashboardCriticalPayments {
  due_7d: string;
  due_14d: string;
  next_critical: { label: string; due_date: string; amount: string } | null;
}

export interface DashboardOperationalResult {
  revenue: string;
  gross_margin: string;
  ebitda_proxy: string;
  result: string;
}

export interface DashboardAction {
  /** 1 = más prioritaria. */
  priority: number;
  /** Motivo en lenguaje humano. */
  reason: string;
  /** Plazo sugerido (texto, ej. "esta semana"); null si no aplica. */
  deadline: string | null;
  cta_label: string;
  /** Ruta interna a la que lleva el CTA. */
  cta_href: string;
}

export interface DashboardSummaryResponse {
  /** Frase ejecutiva rule-based (NO LLM). null mientras el motor de la frase no
     esté listo (rollout incremental del backend — ver contrato). */
  executive_phrase: string | null;
  /** Cada bloque puede venir null si su fuente falta/falla. */
  pulso: DashboardPulso | null;
  cash_today: DashboardCashToday | null;
  cash_forecast: DashboardCashForecast | null;
  cash_gap: DashboardCashGap | null;
  overdue_collections: DashboardOverdueCollections | null;
  critical_payments: DashboardCriticalPayments | null;
  operational_result: DashboardOperationalResult | null;
  /** Máximo 3 acciones prioritarias. null/[] mientras el motor (Brecha 2,
     heurístico-vs-LLM) no esté resuelto. */
  priority_actions: DashboardAction[] | null;
  generated_at: string;
}

export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: () => [...dashboardKeys.all, "summary"] as const,
};

/** `GET /api/dashboard/summary` — agregado del Inicio Ejecutivo. NO retry. */
export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: () => api.get<DashboardSummaryResponse>("/api/dashboard/summary"),
    staleTime: 30_000,
    retry: false,
  });
}
