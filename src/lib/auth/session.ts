import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "./cookies";
import type { SessionData, UserRole } from "./types";

/* auth() server-side. API compatible con Auth.js v5: devuelve la sesión
   actual o null. Día que se migre a Auth.js v5 (Fase 2 según Anexo A.5.1),
   cambia solo la implementación, no las llamadas.

   C0: el backend de auth aún no existe (C0-11 es CC-API). El check actual
   es "¿existe la cookie de sesión?" — suficiente para gatear rutas. Cuando
   C0-11 implemente GET /api/me, esta función llama ese endpoint para
   obtener el SessionUser real con role, tenant, permisos, etc. */

const TEST_ROLE_COOKIE_NAME = "qavante_test_role";
const VALID_ROLES: readonly UserRole[] = [
  "owner",
  "admin",
  "finance_manager",
  "accountant",
  "viewer",
  "external_advisor",
  "technical_admin",
];

function isValidRole(value: string): value is UserRole {
  return (VALID_ROLES as readonly string[]).includes(value);
}

export async function auth(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie?.value) return null;

  /* Test-only override: cookie qavante_test_role permite a Playwright
     simular usuarios con roles distintos sin tocar el flow real. Gated
     por NEXT_PUBLIC_API_MOCKING==="enabled" — esta env var sólo se setea
     en dev (npm run dev) y en Playwright (webServer.env). En prod el
     triple-guard de MSW (ver init-browser.ts + msw-provider.tsx) impide
     que se active, por lo que esta cookie es efectivamente unreachable
     en prod. Cuando C0-11 baje GET /api/me, este bloque se reemplaza por
     el fetch real al backend. */
  let role: UserRole = "owner";
  if (process.env.NEXT_PUBLIC_API_MOCKING === "enabled") {
    const testRoleCookie = cookieStore.get(TEST_ROLE_COOKIE_NAME);
    if (testRoleCookie?.value && isValidRole(testRoleCookie.value)) {
      role = testRoleCookie.value;
    }
  }

  // Placeholder hasta C0-11 (GET /api/me). La cookie presente significa
  // "logueado" desde la perspectiva del middleware; la validez real la
  // hace el backend cuando el cliente envía la cookie con cada request.
  return {
    user: {
      id: "placeholder",
      email: "placeholder@qavante.com",
      role,
    },
  };
}
