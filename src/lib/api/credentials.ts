/* Tipos + hooks TanStack Query para los endpoints de credenciales SII
   (C1 prep). Alineado con docs/backend-contracts/c1-sii-credentials.md.

   Backend qavante-api todavía no expone estos endpoints. En dev/test el
   handler MSW responde según el contrato; ver ADR-0005 + ADR-0006. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

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
