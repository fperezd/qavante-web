import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/**
 * Read-only company identity contract. The API owns tenancy and ordering; this
 * client type intentionally exposes only what the company picker needs.
 */
export type LegalEntity = components["schemas"]["LegalEntityView"];
type LegalEntitiesResponse = components["schemas"]["LegalEntitiesResponse"];
type LegalEntityNameBody = components["schemas"]["LegalEntityNameRequest"];
type ManagedLegalEntity = components["schemas"]["ManagedLegalEntity"];
type DeclareIdentifierBody = components["schemas"]["DeclareIdentifierRequest"];

export const legalEntityKeys = {
  all: ["legal-entities"] as const,
};

export function useLegalEntities() {
  return useQuery({
    queryKey: legalEntityKeys.all,
    queryFn: () => api.get<LegalEntitiesResponse>("/api/legal-entities"),
    staleTime: 30_000,
    retry: false,
  });
}

export function useCreateLegalEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LegalEntityNameBody) =>
      api.post<ManagedLegalEntity>("/api/legal-entities", { body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: legalEntityKeys.all }),
  });
}

export function useRenameLegalEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: LegalEntityNameBody & { id: string }) =>
      api.patch<ManagedLegalEntity>(`/api/legal-entities/${id}`, { body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: legalEntityKeys.all }),
  });
}

/** Declara una identidad tributaria confirmada por una persona. */
export function useDeclareLegalEntityIdentifier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: DeclareIdentifierBody & { id: string }) =>
      api.post<components["schemas"]["IdentifierView"]>(`/api/legal-entities/${id}/identifier`, {
        body,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: legalEntityKeys.all }),
  });
}
