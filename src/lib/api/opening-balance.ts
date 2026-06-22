import { useMutation } from "@tanstack/react-query";
import { api } from "./client";

/* Capa de datos — Saldo de apertura (onboarding, paso 6). Punto de partida de la
   caja del tenant.

   ⚠️ Contrato FE-FIRST. El endpoint per-cuenta existe
   (`/api/treasury/bank-accounts/{id}/opening-balance`) pero requiere una cuenta
   conectada — durante el onboarding el banco puede no estar conectado todavía.
   Por eso el wizard usa un saldo de apertura MANUAL a nivel tenant:
   `POST /api/treasury/opening-balance` — AÚN NO existe en prod. Ver
   `docs/backend-contracts/onboarding-opening-balance-contract.md`. Gated por
   `onboarding`. Montos string-decimal CLP. */

export interface OpeningBalanceBody {
  /** Saldo inicial total (string-decimal CLP, ej. "1500000"). */
  balance: string;
  /** Fecha del saldo (YYYY-MM-DD). Default: hoy (lo decide el backend si falta). */
  as_of_date?: string;
}

export interface OpeningBalanceResponse {
  balance: string;
  as_of_date: string;
}

/** `POST /api/treasury/opening-balance` — registra el saldo de apertura manual
    del tenant (onboarding). NO retry. */
export function useSetOpeningBalance() {
  return useMutation({
    mutationFn: (body: OpeningBalanceBody) =>
      api.post<OpeningBalanceResponse>("/api/treasury/opening-balance", { body }),
  });
}
