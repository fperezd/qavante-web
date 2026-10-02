"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { explicitCompanyRequestHeaders } from "@/lib/company/active-company";

interface FintocConnectionSummary {
  status: string;
  data_source: string;
}

export const fintocConnectionKeys = {
  all: ["fintoc-connections"] as const,
  company: (companyId: string | null) => [...fintocConnectionKeys.all, companyId] as const,
};

/** ¿La sociedad tiene un banco conectado por Fintoc? `undefined` mientras no se sabe. */
export function hasConnectedBank(connections: readonly FintocConnectionSummary[]): boolean {
  return connections.some(
    (connection) =>
      connection.status.toLowerCase() === "connected" &&
      connection.data_source.toLowerCase() === "fintoc",
  );
}

export function useCompanyHasConnectedBank(companyId: string | null): boolean | undefined {
  const query = useQuery({
    queryKey: fintocConnectionKeys.company(companyId),
    enabled: Boolean(companyId),
    queryFn: () =>
      api.get<FintocConnectionSummary[]>("/api/fintoc/connections", {
        headers: explicitCompanyRequestHeaders(companyId!),
      }),
  });
  if (!companyId || query.isError) return false;
  return query.data ? hasConnectedBank(query.data) : undefined;
}
