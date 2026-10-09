import type { SignupAccountValues } from "./signup-form-schema";

const ACCOUNT_DRAFT_KEY = "qavante.signup.accountDraft";
const EXTRA_TENANTS_KEY = "qavante.signup.extraTenants";

export type SignupAccountDraft = SignupAccountValues;

export type PendingSignupTenant = {
  legal_name: string;
  rut: string;
};

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  sessionStorage.setItem(key, JSON.stringify(value));
}

export function saveSignupAccountDraft(draft: SignupAccountDraft): void {
  writeJson(ACCOUNT_DRAFT_KEY, draft);
}

export function readSignupAccountDraft(): SignupAccountDraft | null {
  return readJson<SignupAccountDraft>(ACCOUNT_DRAFT_KEY);
}

export function clearSignupAccountDraft(): void {
  sessionStorage.removeItem(ACCOUNT_DRAFT_KEY);
}

export function saveExtraSignupTenants(tenants: PendingSignupTenant[]): void {
  writeJson(EXTRA_TENANTS_KEY, tenants);
}

export function readExtraSignupTenants(): PendingSignupTenant[] {
  return readJson<PendingSignupTenant[]>(EXTRA_TENANTS_KEY) ?? [];
}

export function clearExtraSignupTenants(): void {
  sessionStorage.removeItem(EXTRA_TENANTS_KEY);
}
