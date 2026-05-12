import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";

/* Middleware Qavante. Protege las rutas del route group (app) — solo
   permite continuar si hay cookie de sesión (no valida vs backend; la
   validez real la chequea cada request al backend cuando envía la
   cookie). Sin cookie redirige a /login con query ?redirect= para
   volver post-login.

   Patrón compatible con Auth.js v5 (Anexo A.5.1). Cuando migremos a
   Fase 2 con OAuth Google/MS, el matcher y la lógica de cookie quedan
   iguales; solo cambia la validación en lib/auth/session.ts. */

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  if (sessionCookie?.value) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  /* Aplica solo a las 6 rutas del menú principal (Anexo B.7).
     Login, recuperar-clave y rutas públicas (/, /playground) no entran. */
  matcher: [
    "/inicio/:path*",
    "/caja/:path*",
    "/cobrar/:path*",
    "/pagar/:path*",
    "/gestion/:path*",
    "/administracion/:path*",
  ],
};
