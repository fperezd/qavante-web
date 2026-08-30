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
  /* TODAS las carpetas de primer nivel del route group `(app)`. Esta lista es un
     allow-list a mano y por eso se desincroniza sola: cada pantalla nueva bajo `(app)/`
     que no se agregue acá se sirve SIN sesión, con el shell entero renderizado. Ya pasó
     con `/mi-cuenta` (#7) y volvió a pasar con `/alertas` y `/conexiones` — y el barrido
     de este arreglo destapó que `/banco`, `/presupuesto` y `/remuneraciones` llevaban
     tiempo igual de abiertas. `src/app/(app)/layout.tsx` documenta que asume lo
     contrario ("si auth() devuelve null el middleware ya redirigió"), así que la premisa
     estaba falseada para cinco pantallas.

     `tests/e2e/auth-redirect.spec.ts` ya NO copia esta lista a mano: la deriva leyendo
     el directorio `(app)/`, así que una pantalla nueva sin su entrada acá rompe el CI.
     Si agregas una carpeta a `(app)/`, agregala también acá.

     Login, recuperar-clave y rutas públicas (`/`, `/playground`) viven fuera de `(app)`
     y no entran. */
  matcher: [
    "/administracion/:path*",
    "/alertas/:path*",
    "/banco/:path*",
    "/bandeja/:path*",
    "/caja/:path*",
    "/cobrar/:path*",
    "/conexiones/:path*",
    "/gestion/:path*",
    "/inicio/:path*",
    "/mi-cuenta/:path*",
    "/pagar/:path*",
    "/presupuesto/:path*",
    "/remuneraciones/:path*",
    /* Pasos post-auth del wizard de onboarding (conectar SII/banco, rubro, saldo
       apertura, sincronizar). Vive en el grupo `(onboarding)`, no en `(app)`.
       /registro y /verificar son pre-auth → NO entran. */
    "/onboarding/:path*",
  ],
};
