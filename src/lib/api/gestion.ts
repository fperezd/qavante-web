import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/* Capa de datos — Resultado Operacional de Gestión (Sprint C5, Documento
   Maestro §7.5 / §11.5).

   El endpoint `GET /api/management/operational-result` está VIVO en prod y acepta cookie
   (sondeado 2026-07-17). El flag `operationalResult` está ON → este hook SÍ corre en prod.

   ⚠️ Deuda pendiente (plan de cierre C1): estos tipos siguen HAND-ROLLED en vez de generados
   (rompe la regla 3). Cierre = `npm run generate:api` y reemplazar por los de `types.ts`.
   ⚠️ Gap de dato (plan de cierre A1, CC-API): el resultado se calcula solo del RCV → NO incluye
   remuneraciones → sale inflado (`result > revenue`). El FE lo degrada honesto en Gestión v2.

   Montos como string-decimal (igual que el resto del API treasury); el FE
   parsea con `parseDecimal`. "Resultado de gestión, no contabilidad oficial"
   es un badge del FE (no viene del backend). */

/* Tipos GENERADOS del OpenAPI (regla 3). Antes eran hand-rolled FE-first; CC-API ya shipeó el
   contrato, así que se adoptan los generados (barrido de higiene 2026-07, C1). Ojo con el generado
   vs el viejo hand-rolled: `variation` es un objeto con `vs_previous_month`/`vs_same_month_last_year`
   OPCIONALES (`?`), `drivers` es OPCIONAL, y hay campos extra (`financial_expense`, `unclassified`).
   Los consumidores ya guardan con `?.`/`?? []`. */
export type OperationalResultVariation = components["schemas"]["ResultVariation"];
export type OperationalResultDriver = components["schemas"]["OperationalDriver"];
export type OperationalResultResponse = components["schemas"]["OperationalResultResponse"];

/* Estado de Resultados mensualizado por categoría (árbol de cuentas del tenant),
   estilo Chipax: meses en columnas, filas jerárquicas (Ingresos/Costos/Margen…),
   mes en curso marcado `proforma`. Tipos GENERADOS (regla 3). */
export type OperationalResultBreakdown =
  components["schemas"]["OperationalResultBreakdownResponse"];
export type BreakdownRow = components["schemas"]["BreakdownRow"];

/* Drill-down por documento de una cuenta de gestión (CC-API #786): qué facturas caen en una cuenta
   en un período. Tipos GENERADOS (regla 3). */
export type OperationalResultDocuments =
  components["schemas"]["OperationalResultDocumentsResponse"];
export type OperationalResultDocument = components["schemas"]["OperationalResultDocument"];

/* Propuestas de clasificación (IA + aprendizaje por contraparte, ADR-0062): para lo sin clasificar,
   sugiere la cuenta de gestión por documento. Confirmar aplica la sugerencia Y crea una regla por la
   contraparte (los futuros docs de ese proveedor se clasifican solos). Tipos GENERADOS. */
export type ClassificationProposal = components["schemas"]["ClassificationProposal"];
export type ClassificationProposals = components["schemas"]["ProposalsResponse"];
export type ClassifyRunResponse = components["schemas"]["ClassifyRunResponse"];

export const gestionKeys = {
  all: ["gestion"] as const,
  operationalResult: (period: string) =>
    [...gestionKeys.all, "operational-result", period] as const,
  operationalResultBreakdown: (from: string, to: string, mode: string) =>
    [...gestionKeys.all, "operational-result-breakdown", from, to, mode] as const,
  operationalResultDocuments: (period: string, account: string) =>
    [...gestionKeys.all, "operational-result-documents", period, account] as const,
};

/** `GET /api/management/operational-result?period=YYYY-MM` — un mes (desglose
 *  fino + drivers). Solo corre con `period` no vacío. NO retry. */
export function useOperationalResult(period: string) {
  return useQuery({
    queryKey: gestionKeys.operationalResult(period),
    queryFn: () =>
      api.get<OperationalResultResponse>(
        `/api/management/operational-result?period=${encodeURIComponent(period)}`,
      ),
    enabled: period !== "",
    staleTime: 30_000,
    retry: false,
  });
}

/** `GET /api/management/operational-result/breakdown` — Estado de Resultados
 *  mensualizado por categoría (árbol), estilo Chipax. `mode` = eje de agrupación
 *  (por_cuenta por defecto); `include_proforma` marca el mes en curso. */
export function useOperationalResultBreakdown(
  from: string,
  to: string,
  { mode = "por_cuenta", includeProforma = true, enabled = true } = {},
) {
  return useQuery({
    queryKey: gestionKeys.operationalResultBreakdown(from, to, mode),
    queryFn: () =>
      api.get<OperationalResultBreakdown>(
        `/api/management/operational-result/breakdown?period_from=${encodeURIComponent(
          from,
        )}&period_to=${encodeURIComponent(to)}&mode=${encodeURIComponent(mode)}&include_proforma=${
          includeProforma ? "true" : "false"
        }`,
      ),
    enabled: enabled && from !== "" && to !== "",
    staleTime: 30_000,
    retry: false,
  });
}

/** `GET /api/management/operational-result/documents?period=YYYY-MM&account=<code>` — los documentos
 *  (facturas) que caen en una cuenta de gestión ese mes (drill-down "clic en la línea → sus facturas").
 *  Solo corre habilitado y con period+account no vacíos (típico: al expandir la línea). NO retry. */
export function useOperationalResultDocuments(period: string, account: string, enabled = true) {
  return useQuery({
    queryKey: gestionKeys.operationalResultDocuments(period, account),
    queryFn: () =>
      api.get<OperationalResultDocuments>(
        `/api/management/operational-result/documents?period=${encodeURIComponent(
          period,
        )}&account=${encodeURIComponent(account)}`,
      ),
    enabled: enabled && period !== "" && account !== "",
    staleTime: 30_000,
    retry: false,
  });
}

/** `GET /api/management/operational-result/classifications/proposals` — propuestas de clasificación
 *  (cuenta sugerida por documento) para lo sin clasificar. Solo corre habilitado. NO retry. */
export function useClassificationProposals(enabled = true) {
  return useQuery({
    queryKey: [...gestionKeys.all, "classification-proposals"] as const,
    queryFn: () =>
      api.get<ClassificationProposals>(
        "/api/management/operational-result/classifications/proposals",
      ),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

/** `POST /api/management/operational-result/classifications/{id}/confirm` — aplica la sugerencia +
 *  crea una regla por contraparte (aprende). Invalida Gestión (documents/breakdown/proposals) para
 *  que el documento salga de "sin clasificar" al cerrar. */
export function useConfirmClassification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (classificationId: string) =>
      api.post<unknown>(
        `/api/management/operational-result/classifications/${encodeURIComponent(
          classificationId,
        )}/confirm`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: gestionKeys.all });
    },
  });
}

/** `POST /api/management/operational-result/classify?period_from&period_to` — corre el clasificador IA
 *  sobre el residuo sin clasificar del período: aplica solo lo de confianza ALTA y encola el resto
 *  como propuestas (confianza media) para revisar. Idempotente (no re-manda lo ya aplicado). Devuelve
 *  `status='llm_off'` si el clasificador está apagado. Invalida Gestión para refrescar documents +
 *  proposals + breakdown. */
export function useRunClassification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (period: string) =>
      api.post<ClassifyRunResponse>(
        `/api/management/operational-result/classify?period_from=${encodeURIComponent(
          period,
        )}&period_to=${encodeURIComponent(period)}`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: gestionKeys.all });
    },
  });
}
