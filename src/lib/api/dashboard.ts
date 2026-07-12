import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/* Capa de datos — Inicio Ejecutivo / Dashboard (Sprint C8, Documento Maestro
   §7.1).

   `GET /api/dashboard/summary` ya existe en el backend (expuesto 2026-06-03,
   acepta cookie). Tipos GENERADOS desde el OpenAPI (regla 3); re-exportados con
   los nombres `Dashboard*` que ya consumen la vista y los helpers. Contrato en
   `docs/backend-contracts/inicio-dashboard-summary-contract.md`.

   Cada bloque es NULLABLE (y opcional en el schema): una fuente puede
   faltar/fallar sin tumbar el dashboard (Maestro §7.1: "carga aunque una fuente
   falle"; faltante ≠ 0). La frase ejecutiva es rule-based (NO LLM, Anexo H.1).
   Montos string-decimal. */

export type DashboardPulso = components["schemas"]["Pulso"];
/** Estados canónicos del Pulso (Anexo C). */
export type PulsoStatus = DashboardPulso["status"];
/** Niveles de confianza conocidos (el backend manda string; mapeamos estos). */
export type Confidence = "high" | "medium" | "low";

export type DashboardCashToday = components["schemas"]["CashToday"];
export type DashboardCashForecast = components["schemas"]["CashForecast"];
export type DashboardCashGap = components["schemas"]["CashGap"];
export type DashboardOverdueCollections = components["schemas"]["OverdueCollections"];
export type DashboardCriticalPayments = components["schemas"]["CriticalPayments"];
export type DashboardOperationalResult = components["schemas"]["OperationalResult"];
export type DashboardAction = components["schemas"]["PriorityAction"];
export type DashboardSummaryResponse = components["schemas"]["DashboardSummaryResponse"];

/* ── Inicio Ejecutivo v2 (rediseño) — campos EXTENDIDOS, FE-first ──────────────
   El v2 reordena la jerarquía (caja/runway al frente) y agrega las "3 fechas
   clave del mes" + tendencia de caja. Estos campos AÚN NO existen en el schema
   generado; son hand-rolled y opcionales (el backend los agregará — ver el
   contrato). Mientras tanto vienen por MSW. Gated por `inicioEjecutivoV2`. */

/** Estado de una obligación clave contra la caja proyectada. */
export type ObligationCoverage = "covered" | "tight" | "uncovered";

/** Una de las 3 fechas clave del mes (imposiciones / impuestos mensuales /
   sueldos). El cálculo del estado es del backend; el FE solo muestra. */
export interface DashboardKeyObligation {
  /** Identificador estable: "imposiciones" | "impuestos_mensuales" | "sueldos". */
  key: string;
  /** Etiqueta legible (ej. "Impuestos Mensuales (F29)"). */
  label: string;
  /** Vencimiento (ISO date). */
  due_date: string;
  amount: string;
  coverage: ObligationCoverage;
}

/** Respuesta extendida del v2 = la base + los campos nuevos (todos opcionales,
   degradan solos si el backend aún no los manda). */
export interface DashboardSummaryV2 extends DashboardSummaryResponse {
  /** Hasta 3 obligaciones clave del mes, por fecha. */
  key_obligations?: DashboardKeyObligation[] | null;
  /** Puntos para el sparkline de caja (más reciente último). */
  cash_sparkline?: number[] | null;
  /** Variación % de la caja vs período anterior (ej. 8 = +8%). */
  cash_delta_pct?: number | null;
}

export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: () => [...dashboardKeys.all, "summary"] as const,
};

/** `GET /api/dashboard/summary` — agregado del Inicio Ejecutivo. NO retry.
   Devuelve el tipo extendido v2 (superset); el v1 lee solo los campos base. */
export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: () => api.get<DashboardSummaryV2>("/api/dashboard/summary"),
    staleTime: 30_000,
    retry: false,
  });
}
