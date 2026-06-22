import { useMutation } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/* Capa de datos — Saldo de apertura (onboarding, paso 6). Punto de partida de la
   caja del tenant.

   `POST /api/treasury/opening-balance` (semilla de caja tenant-level) YA está en
   prod (2026-06-22, qavante-api #346) → tipo GENERADO. Es standalone: NO suma a
   los saldos per-cuenta; los reemplaza como punto de partida. Gated por
   `onboarding`. Montos como string-decimal CLP. */

export type OpeningBalanceBody = components["schemas"]["SetTenantOpeningBalanceRequest"];

/** `POST /api/treasury/opening-balance` — registra el saldo de apertura manual
    del tenant (onboarding). NO retry. */
export function useSetOpeningBalance() {
  return useMutation({
    mutationFn: (body: OpeningBalanceBody) =>
      api.post<void>("/api/treasury/opening-balance", { body }),
  });
}
