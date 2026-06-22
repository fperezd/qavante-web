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

/** `PUT /api/credentials/bice` — conecta/rota las credenciales del banco. */
export function usePutBiceCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PutBankCredentialBody) => api.put<void>("/api/credentials/bice", { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: bankCredentialKeys.bice }),
  });
}
