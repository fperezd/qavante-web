import { api } from "@/lib/api/client";
import {
  clearExtraSignupTenants,
  readExtraSignupTenants,
  type PendingSignupTenant,
} from "@/components/onboarding/signup-draft";

/** Crea en la API las empresas extra guardadas durante el registro (post-verificación). */
export async function createPendingSignupTenants(): Promise<void> {
  const pending: PendingSignupTenant[] = readExtraSignupTenants();
  if (pending.length === 0) return;
  clearExtraSignupTenants();
  for (const tenant of pending) {
    await api.post<void>("/api/me/tenants", {
      body: { legal_name: tenant.legal_name, rut: tenant.rut },
    });
  }
}
