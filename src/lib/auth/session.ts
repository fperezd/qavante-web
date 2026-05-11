import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "./cookies";
import type { SessionData } from "./types";

/* auth() server-side. API compatible con Auth.js v5: devuelve la sesión
   actual o null. Día que se migre a Auth.js v5 (Fase 2 según Anexo A.5.1),
   cambia solo la implementación, no las llamadas.

   C0: el backend de auth aún no existe (C0-11 es CC-API). El check actual
   es "¿existe la cookie de sesión?" — suficiente para gatear rutas. Cuando
   C0-11 implemente GET /api/me, esta función llama ese endpoint para
   obtener el SessionUser real con role, tenant, permisos, etc. */

export async function auth(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie?.value) return null;

  // Placeholder hasta C0-11 (GET /api/me). La cookie presente significa
  // "logueado" desde la perspectiva del middleware; la validez real la
  // hace el backend cuando el cliente envía la cookie con cada request.
  return {
    user: {
      id: "placeholder",
      email: "placeholder@qavante.cl",
      role: "owner",
    },
  };
}
