import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

/**
 * Read-only company identity contract. The API owns tenancy and ordering; this
 * client type intentionally exposes only what the company picker needs.
 */
export type LegalEntity = {
  id: string;
  legal_name: string;
  is_default: boolean;
};

type LegalEntitiesResponse = { entities: LegalEntity[] };

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
