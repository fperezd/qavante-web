import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

/* Contrato versionado en qavante-api#407. Este módulo queda aislado hasta que ese
 * contrato llegue a producción y `generate:api` pueda regenerar `types.ts` sin
 * adelantar todos los contratos aún no desplegados de API main. */
export interface OpeningCutoffRequest {
  cutoff_date: string;
  keep_open?: string[];
}

export interface OpeningCutoffImpact {
  receivables_saldadas: number;
  payables_saldadas: number;
  movimientos_clasificacion_retirados: number;
  movimientos_conciliacion_retirados: number;
}

export interface OpeningCutoffStatus {
  configured: boolean;
  active: boolean;
  cutoff_date?: string | null;
  applied_at?: string | null;
  reverted_at?: string | null;
}

export interface OpeningCutoffRevertResult {
  receivables_reabiertas: number;
  payables_reabiertas: number;
  movimientos_restaurados: number;
}

export const openingCutoffKeys = {
  all: ["opening-cutoff"] as const,
  status: () => [...openingCutoffKeys.all, "status"] as const,
};

export function useOpeningCutoffStatus() {
  return useQuery({
    queryKey: openingCutoffKeys.status(),
    queryFn: () => api.get<OpeningCutoffStatus>("/api/treasury/reconciliation/opening-cutoff"),
    staleTime: 30_000,
    retry: false,
  });
}

export function usePreviewOpeningCutoff() {
  return useMutation({
    mutationFn: (body: OpeningCutoffRequest) =>
      api.post<OpeningCutoffImpact>("/api/treasury/reconciliation/opening-cutoff/preview", {
        body,
      }),
  });
}

async function invalidateOpeningCutoffConsumers(qc: ReturnType<typeof useQueryClient>) {
  // El corte afecta AR, AP, clasificación, conciliación, caja e indicadores.
  // Es una operación administrativa infrecuente: refrescar el tenant completo
  // evita dejar una cifra vieja en alguna vista con una key de dominio distinta.
  await qc.invalidateQueries();
}

export function useApplyOpeningCutoff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OpeningCutoffRequest) =>
      api.post<OpeningCutoffImpact>("/api/treasury/reconciliation/opening-cutoff", { body }),
    onSuccess: () => invalidateOpeningCutoffConsumers(qc),
  });
}

export function useRevertOpeningCutoff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<OpeningCutoffRevertResult>("/api/treasury/reconciliation/opening-cutoff/revert"),
    onSuccess: () => invalidateOpeningCutoffConsumers(qc),
  });
}
