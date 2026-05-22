/* Capa de datos — Currencies: catálogo global + tipo de cambio + settings
 * del tenant (Addendum §15.2/§15.4/§15.7).
 *
 * Endpoints contractuales (verificados live 2026-05-21):
 * - `GET  /api/core/currencies`               → catálogo global (Currency[]).
 * - `GET  /api/core/exchange-rates?base&quote&date?` → lookup TC; si falta,
 *      `data_status='requires_attention'` y `rate=null` (§15.7) — NO es error.
 * - `GET  /api/core/company-currency-settings`  → settings del tenant (404 si
 *      todavía no sembrados — fallback a defaults en la UI).
 * - `PATCH /api/core/company-currency-settings` → update parcial owner/admin.
 *
 * Tipos del OpenAPI generado (`./types`), NUNCA hand-rolled (regla 3). El
 * gating de la UI lo hace `multiCurrency` (ADR-0008) en su PR de wire. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { ApiError } from "./errors";
import type { components } from "./types";

export type Currency = components["schemas"]["Currency"];
export type CurrenciesResponse = components["schemas"]["CurrenciesResponse"];
export type ExchangeRate = components["schemas"]["ExchangeRate"];
export type ExchangeRateLookupResponse = components["schemas"]["ExchangeRateLookupResponse"];
export type CompanyCurrencySettings = components["schemas"]["CompanyCurrencySettings"];
export type UpdateCompanyCurrencySettingsRequest =
  components["schemas"]["UpdateCompanyCurrencySettingsRequest"];

export interface ExchangeRateLookupParams {
  /** Moneda base (ej "UF"). */
  base: string;
  /** Moneda destino (ej "CLP"). */
  quote: string;
  /** Fecha YYYY-MM-DD; si se omite, más reciente. */
  date?: string;
}

export const currenciesKeys = {
  all: ["currencies"] as const,
  list: () => [...currenciesKeys.all, "list"] as const,
  exchangeRate: (params: ExchangeRateLookupParams) =>
    [...currenciesKeys.all, "exchange-rate", params] as const,
  companySettings: () => [...currenciesKeys.all, "company-settings"] as const,
};

/** `GET /api/core/currencies` — catálogo global de monedas. Catálogo casi
 *  estático (fiat + indexed_unit), staleTime alto. */
export function useCurrencies() {
  return useQuery({
    queryKey: currenciesKeys.list(),
    queryFn: () => api.get<CurrenciesResponse>("/api/core/currencies"),
    staleTime: 60 * 60 * 1000, // 1 h
    retry: false,
  });
}

function buildExchangeRateQuery(p: ExchangeRateLookupParams): string {
  const s = new URLSearchParams();
  s.set("base", p.base);
  s.set("quote", p.quote);
  if (p.date) s.set("date", p.date);
  return `?${s.toString()}`;
}

/** `GET /api/core/exchange-rates` — lookup de tipo de cambio. La ausencia
 *  NO es error (§15.7): `data_status='requires_attention'` + `rate=null`.
 *  Solo corre con `base` y `quote` no vacíos. */
export function useExchangeRate(params: ExchangeRateLookupParams) {
  return useQuery({
    queryKey: currenciesKeys.exchangeRate(params),
    queryFn: () =>
      api.get<ExchangeRateLookupResponse>(
        `/api/core/exchange-rates${buildExchangeRateQuery(params)}`,
      ),
    enabled: Boolean(params.base) && Boolean(params.quote),
    staleTime: 5 * 60 * 1000, // 5 min — los TC se publican diariamente
    retry: false,
  });
}

/** `GET /api/core/company-currency-settings` — settings de moneda del
 *  tenant. **El 404 NO es error visible**: significa "no sembrados todavía",
 *  la UI cae a defaults (CLP funcional, sin reporting/indexed_unit). Por eso
 *  el query mapea 404 → `data: null` en lugar de throw. */
export function useCompanyCurrencySettings() {
  return useQuery({
    queryKey: currenciesKeys.companySettings(),
    queryFn: async (): Promise<CompanyCurrencySettings | null> => {
      try {
        return await api.get<CompanyCurrencySettings>("/api/core/company-currency-settings");
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

/** `PATCH /api/core/company-currency-settings` — update parcial. 403 si el
 *  role no es owner/admin (§20). Invalida el cache de settings al éxito. */
export function useUpdateCompanyCurrencySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateCompanyCurrencySettingsRequest) =>
      api.patch<CompanyCurrencySettings>("/api/core/company-currency-settings", { body }),
    onSuccess: (data) => {
      qc.setQueryData(currenciesKeys.companySettings(), data);
      qc.invalidateQueries({ queryKey: currenciesKeys.all });
    },
  });
}
