export const ACTIVE_COMPANY_STORAGE_KEY = "qavante.active-company-id";

export const UNATTRIBUTED_COMPANY_ID = "unattributed";

const COMPANY_HEADER = "X-Qavante-Company-Id";

function isLegalEntityList(path: string): boolean {
  return path === "/api/legal-entities" || path.startsWith("/api/legal-entities?");
}

/** Header de la razón social activa. La lista de sociedades no lo manda: tiene que verlas todas. */
export function companyRequestHeaders(path: string): Record<string, string> {
  if (isLegalEntityList(path) || typeof window === "undefined") return {};
  const companyId = window.localStorage.getItem(ACTIVE_COMPANY_STORAGE_KEY);
  return companyId ? { [COMPANY_HEADER]: companyId } : {};
}

export function clearActiveCompanyId(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_COMPANY_STORAGE_KEY);
}
