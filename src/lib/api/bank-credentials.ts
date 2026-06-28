/* Capa de datos — Credenciales del banco (BICE). Conecta/rota las credenciales
   con `PUT /api/credentials/bice` ({rut, password}); el backend las cifra y las
   usa para traer movimientos. No hay flujo web/OAuth self-serve: es por
   credenciales. Tipos del OpenAPI generado (`./types`), nunca hand-rolled. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type BankCredentialStatus = components["schemas"]["BankCredentialStatus"];
export type PutBankCredentialBody = components["schemas"]["PutBankCredentialRequest"];

export const bankCredentialKeys = {
  bice: ["bank-credentials", "bice"] as const,
};

/** `GET /api/credentials/bice` — estado de la conexión (sin exponer la clave). */
export function useBiceCredentialStatus(enabled = true) {
  return useQuery({
    queryKey: bankCredentialKeys.bice,
    queryFn: () => api.get<BankCredentialStatus>("/api/credentials/bice"),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

/** `PUT /api/credentials/bice` — conecta/rota las credenciales del banco.
 *  `skipAuthRetry`: durante el onboarding (sesión recién creada) un 401 acá es
 *  rechazo persistente del endpoint, no expiración → que caiga como ApiError
 *  inline ("no pudimos conectar el banco") en vez de expulsar al login. */
export function usePutBiceCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PutBankCredentialBody) =>
      api.put<void>("/api/credentials/bice", { body, skipAuthRetry: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: bankCredentialKeys.bice }),
  });
}

/** Dispara la traída de movimientos del banco: cuentas
 *  (`POST /api/bank-movements/bice/sync`) **y** tarjetas de crédito
 *  (`POST /api/bank-movements/bice/cards/sync`). Conectar las credenciales NO
 *  trae datos solo; hay que sincronizar. Los movimientos se ven en Caja.
 *  Tolerante a fallas parciales: tiene éxito si al menos una fuente sincronizó.
 *  NO retry. */
export function useSyncBiceMovements() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const [accounts, cards] = await Promise.allSettled([
        api.post<unknown>("/api/bank-movements/bice/sync"),
        api.post<unknown>("/api/bank-movements/bice/cards/sync"),
      ]);
      // Si ambas fallaron, propagamos el error de cuentas (el principal).
      if (accounts.status === "rejected" && cards.status === "rejected") {
        throw accounts.reason;
      }
      return {
        accounts: accounts.status === "fulfilled",
        cards: cards.status === "fulfilled",
      };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank-movements"] }),
  });
}
