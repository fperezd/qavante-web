import type { BrowserContext } from "@playwright/test";

/* Helpers compartidos de los e2e. NO es un spec (no matchea *.spec.ts) →
   Playwright no lo corre como test. */

export const BASE_URL = "http://localhost:3100";

export type TestRole = "owner" | "admin" | "viewer" | "accountant";

/* Evita el flow real de login: setea la cookie `qavante_session` (el
   middleware la valida como "logueado") + `qavante_test_role` para que
   session.ts devuelva el role pedido (gated por NODE_ENV !== production). */
export async function loginAs(context: BrowserContext, role: TestRole = "owner"): Promise<void> {
  await context.addCookies([
    { name: "qavante_session", value: "msw-mock-token", url: BASE_URL },
    { name: "qavante_test_role", value: role, url: BASE_URL },
  ]);
}
