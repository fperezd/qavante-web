/* Capa de datos — Credenciales SII (Opción A, decisión Fernando 2026-05-18).
 *
 * Modelo vivo: UNA credencial SII por tenant (`source_code=sii_rcv`) +
 * colección multi-holder de certificados digitales. `persons[]` está FUERA
 * DE SCOPE — no inventar endpoints de persona (regla 16; confirmado por
 * backend). Contrato canónico in-repo (qavante-api):
 * `docs/contracts/sii-credentials-contract.md`. El viejo
 * `c1-sii-credentials.md` quedó SUPERSEDED.
 *
 * Tipos del OpenAPI generado (`./types`), NUNCA hand-rolled (regla 3). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type CredentialMetadataResponse = components["schemas"]["CredentialMetadataResponse"];
export type CredentialPutResponse = components["schemas"]["CredentialPutResponse"];
export type CredentialTestResponse = components["schemas"]["CredentialTestResponse"];
export type CertificateMetadataResponse = components["schemas"]["CertificateMetadataResponse"];
export type CertificatesListResponse = components["schemas"]["CertificatesListResponse"];
export type CertificateUploadRequest = components["schemas"]["CertificateUploadRequest"];
/** Body de `PUT /api/credentials/sii/person` — `{rut, name?, password}`. */
export type PutSiiPersonRequest = components["schemas"]["PutSiiPersonRequest"];

/** Source code único de la credencial de login SII (Opción A): UNA por tenant. */
export const SII_SOURCE_CODE = "sii_rcv";

/** Source code de la credencial de BUK (Remuneraciones): token por tenant
 *  (ADR-0056). El sync de planilla a Pagar la necesita (sin fallback global). */
export const BUK_SOURCE_CODE = "buk";

/** Payload genérico de `POST /credential`. Para SII: `{rut, password}`
 *  (las `expected_keys` las declara el backend en GET .../credential). */
export type SiiCredentialPayload = Record<string, unknown>;

export const credentialsKeysV2 = {
  all: ["credentials-v2"] as const,
  siiCredential: () =>
    [...credentialsKeysV2.all, "sources", SII_SOURCE_CODE, "credential"] as const,
  bukCredential: () =>
    [...credentialsKeysV2.all, "sources", BUK_SOURCE_CODE, "credential"] as const,
  certificates: () => [...credentialsKeysV2.all, "certificates"] as const,
};

/** `GET /api/admin/sources/sii_rcv/credential` — metadata de la credencial
 *  (is_active, expected_keys, label, etc.). No devuelve la clave. */
export function useSiiCredential() {
  return useQuery({
    queryKey: credentialsKeysV2.siiCredential(),
    queryFn: () =>
      api.get<CredentialMetadataResponse>(`/api/admin/sources/${SII_SOURCE_CODE}/credential`),
    staleTime: 30_000,
    retry: false,
  });
}

/** `POST /api/admin/sources/sii_rcv/credential` — guarda/rota la credencial. */
export function usePutSiiCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SiiCredentialPayload) =>
      api.post<CredentialPutResponse>(`/api/admin/sources/${SII_SOURCE_CODE}/credential`, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: credentialsKeysV2.siiCredential() }),
  });
}

/** `PUT /api/credentials/sii/person` — clave del representante legal (persona
 *  autorizada). Necesaria para el **DTE por clave** (emitidos/recibidos, #553): el
 *  listado de DTEs del SII se baja con ESTA credencial, distinta de la del RCV
 *  (`source sii_rcv`). Supera la nota "persons fuera de scope" (mayo): el endpoint
 *  existe desde el login MiPyme por-clave. La clave no se persiste en el FE (regla 6). */
export function usePutSiiPersonCredential() {
  return useMutation({
    mutationFn: (body: PutSiiPersonRequest) =>
      api.put<void>("/api/credentials/sii/person", { body }),
  });
}

/** `GET /api/admin/sources/buk/credential` — metadata de la credencial BUK
 *  (is_active, expected_keys). No devuelve el token. */
export function useBukCredential() {
  return useQuery({
    queryKey: credentialsKeysV2.bukCredential(),
    queryFn: () =>
      api.get<CredentialMetadataResponse>(`/api/admin/sources/${BUK_SOURCE_CODE}/credential`),
    staleTime: 30_000,
    retry: false,
  });
}

/** `POST /api/admin/sources/buk/credential` — guarda/rota el token de BUK.
 *  Body genérico `{api_token}` (las expected_keys las declara el backend). */
export function usePutBukCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SiiCredentialPayload) =>
      api.post<CredentialPutResponse>(`/api/admin/sources/${BUK_SOURCE_CODE}/credential`, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: credentialsKeysV2.bukCredential() }),
  });
}

/** `DELETE /api/admin/sources/sii_rcv/credential` — revoca la credencial. */
export function useDeleteSiiCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<void>(`/api/admin/sources/${SII_SOURCE_CODE}/credential`),
    onSuccess: () => qc.invalidateQueries({ queryKey: credentialsKeysV2.siiCredential() }),
  });
}

/** `POST /api/admin/sources/sii_rcv/credential/test` — valida la credencial. */
export function useTestSiiCredential() {
  return useMutation({
    mutationFn: () =>
      api.post<CredentialTestResponse>(`/api/admin/sources/${SII_SOURCE_CODE}/credential/test`),
  });
}

/** `GET /api/admin/certificates` — lista de certificados (multi-holder). */
export function useCertificatesList() {
  return useQuery({
    queryKey: credentialsKeysV2.certificates(),
    queryFn: () => api.get<CertificatesListResponse>("/api/admin/certificates"),
    staleTime: 30_000,
    retry: false,
  });
}

/** `POST /api/admin/certificates` — sube un .pfx (multi-holder). */
export function useUploadCertificatePfx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CertificateUploadRequest) =>
      api.post<{ certificate: CertificateMetadataResponse }>("/api/admin/certificates", { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: credentialsKeysV2.certificates() }),
  });
}

/** `DELETE /api/admin/certificates/{id}` — elimina un certificado por id. */
export function useDeleteCertificateById() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (certificateId: string) =>
      api.delete<void>(`/api/admin/certificates/${certificateId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: credentialsKeysV2.certificates() }),
  });
}
