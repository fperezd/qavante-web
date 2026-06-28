import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/* Capa de datos — Compras al extranjero (Tesorería). Salen de la cartola de
   tarjeta importada (PDF BICE): compras en moneda extranjera (USD) que requieren
   concepto/categoría. Endpoints (cookie de sesión, verificado 2026-06-28):
   - GET  /api/treasury/foreign-purchases                  → lista
   - POST /api/treasury/foreign-purchases/{id}/classify    → clasifica una
   Tipos generados (regla 3). Montos string-decimal. */

export type ForeignPurchaseItem = components["schemas"]["ForeignPurchaseItem"];
export type ForeignPurchasesListResponse = components["schemas"]["ForeignPurchasesListResponse"];
export type ClassifyForeignPurchaseBody = components["schemas"]["ClassifyForeignPurchaseRequest"];

export const foreignPurchaseKeys = {
  all: ["foreign-purchases"] as const,
  list: () => [...foreignPurchaseKeys.all, "list"] as const,
};

/** `GET /api/treasury/foreign-purchases` — compras al extranjero del tenant. */
export function useForeignPurchases(enabled = true) {
  return useQuery({
    queryKey: foreignPurchaseKeys.list(),
    queryFn: () => api.get<ForeignPurchasesListResponse>("/api/treasury/foreign-purchases"),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

/** `POST /api/treasury/foreign-purchases/{id}/classify` — asigna concepto +
    categoría a una compra. Invalida la lista al éxito. NO retry. */
export function useClassifyForeignPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & ClassifyForeignPurchaseBody) =>
      api.post<unknown>(`/api/treasury/foreign-purchases/${id}/classify`, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: foreignPurchaseKeys.all }),
  });
}
