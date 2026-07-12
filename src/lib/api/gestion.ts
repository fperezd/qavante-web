import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/* Capa de datos — Resultado Operacional de Gestión (Sprint C5, Documento
   Maestro §7.5 / §11.5).

   ⚠️ Contrato FE-FIRST. El endpoint `GET /api/management/operational-result`
   AÚN NO existe en el backend (verificado: no está en el OpenAPI generado).
   Estos tipos están hand-rolled como el contrato ESPERADO, documentado en
   `docs/backend-contracts/gestion-operational-result-contract.md` (handoff a
   CC-API). Cuando el backend lo exponga, `npm run generate:api` reemplaza
   estos tipos por los de `types.ts` (regla 3). Gated por el flag
   `operationalResult` (OFF en prod) → en prod este hook NO corre.

   Montos como string-decimal (igual que el resto del API treasury); el FE
   parsea con `parseDecimal`. "Resultado de gestión, no contabilidad oficial"
   es un badge del FE (no viene del backend). */

export interface OperationalResultVariation {
  /** Variación absoluta (string-decimal CLP). */
  amount: string;
  /** Variación porcentual (string-decimal, ej. "12.5" = +12,5%). */
  pct: string;
}

export interface OperationalResultDriver {
  /** `improves` ⇒ mejora el resultado; `worsens` ⇒ lo deteriora. */
  direction: "improves" | "worsens";
  /** Concepto en lenguaje humano (ej. "Ventas", "Sueldos"). */
  concept: string;
  /** Impacto en el resultado (string-decimal CLP). */
  impact: string;
  /** Explicación corta de por qué. */
  explanation: string;
}

export interface OperationalResultResponse {
  /** Período "YYYY-MM". */
  period: string;
  revenue: string;
  direct_cost: string;
  gross_margin: string;
  /** Margen bruto % (string-decimal, ej. "42.3"). */
  gross_margin_pct: string;
  labor_cost: string;
  professional_fees: string;
  recurring_expenses: string;
  ebitda_proxy: string;
  /** Resultado operacional del mes. */
  result: string;
  variation: {
    vs_previous_month: OperationalResultVariation | null;
    vs_same_month_last_year: OperationalResultVariation | null;
  };
  drivers: OperationalResultDriver[];
  confidence: "high" | "medium" | "low";
  /** Estado del dato (Anexo C estados canónicos): completo / parcial /
   *  estimado. `loading`/`error`/`missing` los maneja la query, no el shape. */
  data_state: "available" | "partial" | "estimated";
  /** Fuentes faltantes que bajan la confianza (Maestro §7.5: "no se asume 0"). */
  missing_sources: string[];
  /** Frescura del cálculo (ISO date-time). */
  generated_at: string;
}

/* Estado de Resultados mensualizado por categoría (árbol de cuentas del tenant),
   estilo Chipax: meses en columnas, filas jerárquicas (Ingresos/Costos/Margen…),
   mes en curso marcado `proforma`. Tipos GENERADOS (regla 3). */
export type OperationalResultBreakdown =
  components["schemas"]["OperationalResultBreakdownResponse"];
export type BreakdownRow = components["schemas"]["BreakdownRow"];

export const gestionKeys = {
  all: ["gestion"] as const,
  operationalResult: (period: string) =>
    [...gestionKeys.all, "operational-result", period] as const,
  operationalResultBreakdown: (from: string, to: string, mode: string) =>
    [...gestionKeys.all, "operational-result-breakdown", from, to, mode] as const,
};

/** `GET /api/management/operational-result?period=YYYY-MM` — un mes (desglose
 *  fino + drivers). Solo corre con `period` no vacío. NO retry. */
export function useOperationalResult(period: string) {
  return useQuery({
    queryKey: gestionKeys.operationalResult(period),
    queryFn: () =>
      api.get<OperationalResultResponse>(
        `/api/management/operational-result?period=${encodeURIComponent(period)}`,
      ),
    enabled: period !== "",
    staleTime: 30_000,
    retry: false,
  });
}

/** `GET /api/management/operational-result/breakdown` — Estado de Resultados
 *  mensualizado por categoría (árbol), estilo Chipax. `mode` = eje de agrupación
 *  (por_cuenta por defecto); `include_proforma` marca el mes en curso. */
export function useOperationalResultBreakdown(
  from: string,
  to: string,
  { mode = "por_cuenta", includeProforma = true, enabled = true } = {},
) {
  return useQuery({
    queryKey: gestionKeys.operationalResultBreakdown(from, to, mode),
    queryFn: () =>
      api.get<OperationalResultBreakdown>(
        `/api/management/operational-result/breakdown?period_from=${encodeURIComponent(
          from,
        )}&period_to=${encodeURIComponent(to)}&mode=${encodeURIComponent(mode)}&include_proforma=${
          includeProforma ? "true" : "false"
        }`,
      ),
    enabled: enabled && from !== "" && to !== "",
    staleTime: 30_000,
    retry: false,
  });
}
