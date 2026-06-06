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
     simular usuarios con roles distintos sin tocar el flow real.

     Defensa en profundidad (hallazgo #6 del 360): el override exige
     NEXT_PUBLIC_API_MOCKING==="enabled" Y un entorno no-prod — el MISMO guard
     que MswProvider/init-browser. Así, aunque NEXT_PUBLIC_API_MOCKING se filtrara
     a un build de prod por error, el override sigue inalcanzable en prod real: un
     atacante NO puede auto-asignarse `owner` vía cookie. NEXT_PUBLIC_API_MOCKING
     solo se setea en dev (npm run dev) y Playwright (webServer.env);
     NEXT_PUBLIC_TEST_MODE==="playwright" solo en e2e (build prod-like). Cuando
     C0-11 baje GET /api/me, este bloque se reemplaza por el fetch real. */
  const testRoleAllowed =
    process.env.NEXT_PUBLIC_API_MOCKING === "enabled" &&
    (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_TEST_MODE === "playwright");
  let role: UserRole = "owner";
  if (testRoleAllowed) {
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
