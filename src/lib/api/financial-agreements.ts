/* Capa de datos — Acuerdos financieros (web#178 / api#387).
 *
 * Endpoints contractuales (api#386, en producción):
 * - `GET  /api/treasury/financial-agreements`                      → lista (por sociedad, opcional).
 * - `POST /api/treasury/financial-agreements`                      → abre una negociación.
 * - `GET  /api/treasury/financial-agreements/{id}`                 → ledger completo (subjects,
 *     latest_terms con calendario, events).
 * - `POST /api/treasury/financial-agreements/{id}/events`          → transición de estado
 *     (incluye formalización con `formalized_terms`).
 *
 * Un acuerdo PROPUESTO (`negotiating`/`offer_received`/`disputed`) es sólo informativo: no
 * cambia ninguna cifra real. Sólo `formalized` sustituye el vencimiento del documento origen
 * en la proyección de caja (api#387) y en "en seguimiento" de Pagar/Cobrar — nunca conviven
 * los dos mostrando la misma obligación por ambos caminos a la vez (decisión de Fernando).
 *
 * Tipos del OpenAPI generado (`./types`), nunca hand-rolled (regla 3).
 */
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type FinancialAgreementListItem = components["schemas"]["FinancialAgreementListItem"];
export type FinancialAgreementListResponse = components["schemas"]["FinancialAgreementListResponse"];
export type FinancialAgreementDetailResponse = components["schemas"]["FinancialAgreementDetailResponse"];
export type FinancialAgreementCreateRequest = components["schemas"]["FinancialAgreementCreateRequest"];
export type FinancialAgreementTransitionRequest =
  components["schemas"]["FinancialAgreementTransitionRequest"];
export type FinancialAgreementMutationResponse =
  components["schemas"]["FinancialAgreementMutationResponse"];
export type FinancialAgreementSubjectResponse =
  components["schemas"]["FinancialAgreementSubjectResponse"];
export type FinancialAgreementEventResponse = components["schemas"]["FinancialAgreementEventResponse"];
export type FinancialAgreementTermsResponse = components["schemas"]["FinancialAgreementTermsResponse"];
export type FinancialAgreementState = FinancialAgreementListItem["state"];
export type FinancialAgreementSubjectKind = FinancialAgreementSubjectResponse["kind"];

export const AGREEMENT_FORMALIZED_STATE: FinancialAgreementState = "formalized";

/** Estados que todavía NO afectan ningún escenario real (sólo informativos). */
export const AGREEMENT_PROPOSED_STATES: readonly FinancialAgreementState[] = [
  "negotiating",
  "offer_received",
  "disputed",
];

export const financialAgreementsKeys = {
  all: ["financial-agreements"] as const,
  list: (legalEntityId: string | null = null) =>
    [...financialAgreementsKeys.all, "list", legalEntityId] as const,
  detail: (agreementId: string) =>
    [...financialAgreementsKeys.all, "detail", agreementId] as const,
};

function listPath(legalEntityId: string | null): string {
  if (!legalEntityId) return "/api/treasury/financial-agreements";
  return `/api/treasury/financial-agreements?${new URLSearchParams({
    legal_entity_id: legalEntityId,
  }).toString()}`;
}

/** `GET /api/treasury/financial-agreements` — lista del tenant, opcionalmente por sociedad. */
export function useFinancialAgreements(legalEntityId: string | null = null) {
  return useQuery({
    queryKey: financialAgreementsKeys.list(legalEntityId),
    queryFn: () => api.get<FinancialAgreementListResponse>(listPath(legalEntityId)),
    staleTime: 15_000,
    retry: false,
  });
}

function detailQuery(agreementId: string) {
  return {
    queryKey: financialAgreementsKeys.detail(agreementId),
    queryFn: () =>
      api.get<FinancialAgreementDetailResponse>(
        `/api/treasury/financial-agreements/${encodeURIComponent(agreementId)}`,
      ),
    staleTime: 15_000,
    retry: false,
  } as const;
}

/** `GET /api/treasury/financial-agreements/{id}` — ledger completo (detalle). */
export function useFinancialAgreement(agreementId: string | null) {
  return useQuery({
    ...detailQuery(agreementId ?? ""),
    enabled: agreementId !== null && agreementId !== "",
  });
}

/** Mismo detalle para varios acuerdos a la vez — usado para resolver qué documentos tienen
 * un acuerdo FORMALIZADO vigente (Pagar/Cobrar, api#387) sin pedirlo fila por fila. */
export function useFinancialAgreementDetails(agreementIds: string[]) {
  return useQueries({ queries: agreementIds.map(detailQuery) });
}

function invalidateAfterAgreementChange(qc: ReturnType<typeof useQueryClient>): void {
  qc.invalidateQueries({ queryKey: financialAgreementsKeys.all });
}

/** `POST /api/treasury/financial-agreements` — abre una negociación interna. No contacta al
 * tercero, no firma, no paga (sólo registra la decisión). */
export function useCreateFinancialAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FinancialAgreementCreateRequest) =>
      api.post<FinancialAgreementMutationResponse>("/api/treasury/financial-agreements", {
        body,
      }),
    onSuccess: () => invalidateAfterAgreementChange(qc),
  });
}

/** `POST /api/treasury/financial-agreements/{id}/events` — transición de estado. Formalizar
 * (`to_state: "formalized"`) exige `formalized_terms` con el calendario completo; es el ÚNICO
 * evento que después afecta la proyección de caja y Pagar/Cobrar. */
export function useTransitionFinancialAgreement(agreementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FinancialAgreementTransitionRequest) =>
      api.post<FinancialAgreementMutationResponse>(
        `/api/treasury/financial-agreements/${encodeURIComponent(agreementId)}/events`,
        { body },
      ),
    onSuccess: () => invalidateAfterAgreementChange(qc),
  });
}

/** Clave estable para indexar un acuerdo por el documento que cubre: `"payable:<uuid>"` /
 * `"receivable:<uuid>"`. Sólo tiene sentido para sujetos con `source_id` (no `external_reference`). */
export function agreementSubjectKey(
  kind: FinancialAgreementSubjectKind,
  sourceId: string,
): string {
  return `${kind}:${sourceId}`;
}

export interface FormalizedAgreementSubjectMatch {
  agreementId: string;
  latestTerms: FinancialAgreementTermsResponse | null;
}

/**
 * Índice `"payable:<uuid>" | "receivable:<uuid>" → acuerdo FORMALIZADO vigente`.
 *
 * Pagar/Cobrar lo usan para reemplazar la fila "en seguimiento" de una obligación por el
 * estado del acuerdo (api#387, decisión de Fernando: nunca los dos a la vez). Un acuerdo
 * `negotiating`/`offer_received`/`disputed` NO entra aquí — es sólo informativo y no debe
 * ocultar ni reemplazar nada del escenario real todavía.
 *
 * La lista no trae `subjects` (sólo el detalle los tiene), así que esto hace N+1: una lista
 * + un detalle por cada acuerdo YA formalizado. Aceptable mientras el volumen de acuerdos sea
 * bajo (negociaciones puntuales, no el volumen de la cartera); si crece, el candidato natural
 * es que el backend sume un endpoint de índice por documento.
 */
/** PURA: construye el índice a partir de detalles ya resueltos. Separada del hook para poder
 * probarla sin montar React Query (`financial-agreements.test.ts`). */
export function buildFormalizedAgreementIndex(
  agreements: Array<FinancialAgreementDetailResponse | null | undefined>,
): Map<string, FormalizedAgreementSubjectMatch> {
  const bySubject = new Map<string, FormalizedAgreementSubjectMatch>();
  for (const agreement of agreements) {
    if (!agreement || agreement.state !== AGREEMENT_FORMALIZED_STATE) continue;
    for (const subject of agreement.subjects) {
      if (!subject.source_id) continue;
      if (subject.kind !== "payable" && subject.kind !== "receivable") continue;
      bySubject.set(agreementSubjectKey(subject.kind, subject.source_id), {
        agreementId: agreement.id,
        latestTerms: agreement.latest_terms ?? null,
      });
    }
  }
  return bySubject;
}

export function useFormalizedAgreementsBySubject(legalEntityId: string | null) {
  const list = useFinancialAgreements(legalEntityId);
  const formalizedIds = (list.data?.items ?? [])
    .filter((item) => item.state === AGREEMENT_FORMALIZED_STATE)
    .map((item) => item.id);
  const details = useFinancialAgreementDetails(formalizedIds);

  const isLoading = list.isLoading || details.some((detail) => detail.isLoading);
  const isError = list.isError || details.some((detail) => detail.isError);
  const bySubject = buildFormalizedAgreementIndex(details.map((detail) => detail.data));

  return { bySubject, isLoading, isError };
}
