"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { legalEntityKeys, useLegalEntities, type LegalEntity } from "@/lib/api/legal-entities";

const STORAGE_KEY = "qavante.active-company-id";

type CompanyScope = {
  activeCompanyId: string | null;
  activeCompany: LegalEntity | null;
  companies: LegalEntity[];
  isLoading: boolean;
  error: unknown;
  refresh: () => void;
  selectCompany: (companyId: string) => void;
};

const CompanyScopeContext = createContext<CompanyScope | null>(null);

/**
 * Every operational API request is scoped by the active-company header. Query
 * keys from legacy screens are not all company-aware yet, so retaining any
 * cache entry across an A -> B selection can render A's data under B. Clear
 * atomically rather than maintaining an incomplete deny-list of query keys.
 */
export function clearCacheForCompanyChange(queryClient: QueryClient): void {
  queryClient.clear();
}

export function isKnownCompany(
  queryClient: QueryClient,
  companies: LegalEntity[],
  companyId: string,
): boolean {
  const latest = queryClient.getQueryData<{ entities: LegalEntity[] }>(
    legalEntityKeys.all,
  )?.entities;
  return (latest ?? companies).some((company) => company.id === companyId);
}

export function CompanyScopeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const companiesQuery = useLegalEntities();
  const companies = companiesQuery.data?.entities ?? [];
  const [requestedCompanyId, setRequestedCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) setRequestedCompanyId(stored);
  }, []);

  const activeCompanyId = useMemo(() => {
    if (!companies.length) return null;
    if (requestedCompanyId && companies.some((company) => company.id === requestedCompanyId)) {
      return requestedCompanyId;
    }
    return companies.find((company) => company.is_default)?.id ?? companies[0]!.id;
  }, [companies, requestedCompanyId]);

  useEffect(() => {
    if (activeCompanyId) window.localStorage.setItem(STORAGE_KEY, activeCompanyId);
  }, [activeCompanyId]);

  const selectCompany = useCallback(
    (companyId: string) => {
      if (!isKnownCompany(queryClient, companies, companyId)) return;
      setRequestedCompanyId(companyId);
      window.localStorage.setItem(STORAGE_KEY, companyId);
      clearCacheForCompanyChange(queryClient);
    },
    [companies, queryClient],
  );

  const value = useMemo<CompanyScope>(
    () => ({
      activeCompanyId,
      activeCompany: companies.find((company) => company.id === activeCompanyId) ?? null,
      companies,
      isLoading: companiesQuery.isLoading,
      error: companiesQuery.error,
      refresh: () => companiesQuery.refetch(),
      selectCompany,
    }),
    [
      activeCompanyId,
      companies,
      companiesQuery.error,
      companiesQuery.isLoading,
      companiesQuery.refetch,
      selectCompany,
    ],
  );

  return <CompanyScopeContext.Provider value={value}>{children}</CompanyScopeContext.Provider>;
}

export function useCompanyScope() {
  const scope = useContext(CompanyScopeContext);
  if (!scope) throw new Error("useCompanyScope must be used inside CompanyScopeProvider");
  return scope;
}
