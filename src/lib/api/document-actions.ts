import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";
import { rejectReconciliationSuggestion } from "./reconciliation";

export type DocumentKind = "payable" | "receivable";
export type ActionDetail = components["schemas"]["DocumentActionDetail"];
export type ActionSearch = components["schemas"]["DocumentActionSearch"];
export type PaymentInput = components["schemas"]["DocumentPaymentInput-Input"];
export type FollowupInput = components["schemas"]["DocumentFollowupInput-Input"];
export type MovementCandidates = components["schemas"]["PaymentMovementCandidates"];
export type PaymentMovement = components["schemas"]["PaymentMovement"];
export const actionPath = (kind: DocumentKind, id?: string) =>
  `/api/treasury/document-actions/${kind}${id ? `/${encodeURIComponent(id)}` : ""}`;

export function useActionDocuments(
  kind: DocumentKind,
  query: string,
  offset: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["document-actions", kind, "search", query, offset],
    queryFn: () =>
      api.get<ActionSearch>(`${actionPath(kind)}?q=${encodeURIComponent(query)}&offset=${offset}`),
    enabled,
    retry: false,
  });
}

export function useActionDocument(kind: DocumentKind, id: string) {
  return useQuery({
    queryKey: ["document-actions", kind, id],
    queryFn: () => api.get<ActionDetail>(actionPath(kind, id)),
    retry: false,
  });
}

export function useDeferredDocuments(kind: DocumentKind) {
  return useQuery({
    queryKey: ["document-actions", kind, "deferred"],
    queryFn: () =>
      api.get<components["schemas"]["DeferredDocuments"]>(
        `/api/treasury/document-actions/deferred/${kind}`,
      ),
    retry: false,
  });
}

export function usePaymentCandidates(kind: DocumentKind, id: string, paymentId?: string) {
  return useQuery({
    queryKey: ["document-actions", kind, id, "candidates", paymentId],
    queryFn: () =>
      api.get<MovementCandidates>(
        `${actionPath(kind, id)}/${paymentId ? `payments/${paymentId}/candidates` : "suggestions"}`,
      ),
    retry: false,
  });
}

export function useDocumentAction(kind: DocumentKind, id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      suffix,
      body,
    }: {
      suffix: string;
      body?: PaymentInput | FollowupInput | { movement_id: string };
    }) => api.post<ActionDetail>(`${actionPath(kind, id)}/${suffix}`, { body }),
    retry: false,
    onSuccess: async (data) => {
      client.setQueryData(["document-actions", kind, id], data);
      // All views derive from the same document. Includes Inicio, Caja, Banco and RCV.
      await client.invalidateQueries();
    },
  });
}

export function useRejectPaymentSuggestion() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: rejectReconciliationSuggestion,
    retry: false,
    onSuccess: () => client.invalidateQueries(),
  });
}
