/* Capa de datos — Credenciales SII.
 *
 * ⚠️ FASE DE TRANSICIÓN (Opción A, decidida por Fernando 2026-05-18):
 *  - `c1-sii-credentials.md` quedó SUPERSEDED. El contrato vivo es el
 *    modelo genérico `/api/admin/sources/{source_code}/credential|test` +
 *    colección `/api/admin/certificates` (multi-holder). `persons[]` NO
 *    existe (fuera de scope — no inventar, regla 16).
 *  - **NUEVA superficie (Opción A) abajo** — usar de acá en adelante. Tipos
 *    del OpenAPI generado (`./types`), nunca hand-rolled (regla 3).
 *  - **VIEJA superficie (`@deprecated`)** se conserva temporalmente para
 *    NO romper consumidores aún migrados (sii-person*, sii-persons-list,
 *    certificate-*, sii-company-*, page credenciales). PR-Cb migra los
 *    consumidores al nuevo modelo y borra todo lo marcado deprecated +
 *    los componentes de personas. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/* ============================================================
   NUEVA superficie — Opción A (sii_rcv + certificados multi-holder)
   ============================================================ */

export type CredentialMetadataResponse = components["schemas"]["CredentialMetadataResponse"];
export type CredentialPutResponse = components["schemas"]["CredentialPutResponse"];
export type CredentialTestResponse = components["schemas"]["CredentialTestResponse"];
export type CertificateMetadataResponse = components["schemas"]["CertificateMetadataResponse"];
export type CertificatesListResponse = components["schemas"]["CertificatesListResponse"];
export type CertificateUploadRequest = components["schemas"]["CertificateUploadRequest"];

/** Source code único de la credencial de login SII (Opción A): UNA por tenant. */
export const SII_SOURCE_CODE = "sii_rcv";

/** Payload genérico de `POST /credential`. Para SII: `{rut, password}`
 *  (las `expected_keys` las declara el backend en GET .../credential). */
export type SiiCredentialPayload = Record<string, unknown>;

export const credentialsKeysV2 = {
  all: ["credentials-v2"] as const,
  siiCredential: () =>
    [...credentialsKeysV2.all, "sources", SII_SOURCE_CODE, "credential"] as const,
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

/* ============================================================
   VIEJA superficie — deprecated, se borra en PR-Cb
   Conservada para mantener el build verde mientras se migran
   los consumidores (sii-company-*, sii-person-*, sii-persons-list,
   certificate-card, certificate-upload-dialog, page credenciales).
   ============================================================ */

export interface SiiCompanyStatus {
  configured: boolean;
  rut?: string;
  last_rotated_at?: string;
}

export interface SiiPersonStatus {
  rut: string;
  name: string | null;
  configured: boolean;
  last_rotated_at: string | null;
}

export interface CertificateStatus {
  configured: boolean;
  subject_rut?: string;
  expires_at?: string;
  uploaded_at?: string;
}

export interface SiiCredentialsStatus {
  company: SiiCompanyStatus;
  persons: SiiPersonStatus[];
  certificate: CertificateStatus;
}

export interface SetCompanyCredentialsBody {
  rut: string;
  password: string;
}

export interface SetPersonCredentialsBody {
  rut: string;
  name?: string;
  password: string;
}

const credentialsKeys = {
  all: ["credentials", "sii"] as const,
  status: () => [...credentialsKeys.all, "status"] as const,
};

export function useSiiCredentialsStatus() {
  return useQuery({
    queryKey: credentialsKeys.status(),
    queryFn: () => api.get<SiiCredentialsStatus>("/api/credentials/sii"),
    staleTime: 30_000,
    retry: false,
  });
}

export function useSetCompanyCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SetCompanyCredentialsBody) =>
      api.put<void>("/api/credentials/sii/company", { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: credentialsKeys.all }),
  });
}

export function useSetPersonCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SetPersonCredentialsBody) =>
      api.put<void>("/api/credentials/sii/person", { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: credentialsKeys.all }),
  });
}

export function useDeletePersonCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rut: string) => api.delete<void>(`/api/credentials/sii/person/${rut}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: credentialsKeys.all }),
  });
}

/* Upload de certificado es multipart/form-data — bypassa api.client porque
   client.ts asume JSON. Hacemos fetch directo y reusamos la convención de
   credentials: 'include' para que la cookie qavante_session viaje, y el
   manejo de errores se hace inline (el FE lee `code` del body). */
async function uploadCertificateMultipart(
  file: File,
  password: string,
): Promise<{ certificate: CertificateStatus }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  const form = new FormData();
  form.append("file", file);
  form.append("password", password);
  const r = await fetch(`${apiUrl}/api/credentials/certificate`, {
    method: "PUT",
    body: form,
    credentials: "include",
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { code?: string; detail?: string };
    throw new Error(body.detail ?? `Error ${r.status}`);
  }
  return r.json() as Promise<{ certificate: CertificateStatus }>;
}

export function useUploadCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, password }: { file: File; password: string }) =>
      uploadCertificateMultipart(file, password),
    onSuccess: () => qc.invalidateQueries({ queryKey: credentialsKeys.all }),
  });
}

export function useDeleteCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<void>("/api/credentials/certificate"),
    onSuccess: () => qc.invalidateQueries({ queryKey: credentialsKeys.all }),
  });
}
