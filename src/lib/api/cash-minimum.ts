import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/* Capa de datos — caja mínima (`GET /api/treasury/cash-minimum`). Umbral por moneda que
   define cuándo la caja "toca el piso" (la línea de la curva de Caja v2). Tipos generados
   (regla 3). NO retry: sin umbral, la curva degrada (no dibuja la línea mínima). */

export type CashMinimumResponse = components["schemas"]["CashMinimumResponse"];
export type CashMinimumThreshold = components["schemas"]["CashMinimumThreshold"];

export const cashMinimumKeys = {
  all: ["cash-minimum"] as const,
};

export function useCashMinimum() {
  return useQuery({
    queryKey: cashMinimumKeys.all,
    queryFn: () => api.get<CashMinimumResponse>("/api/treasury/cash-minimum"),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
