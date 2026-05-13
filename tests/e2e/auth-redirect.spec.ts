import { test, expect } from "@playwright/test";

/* C0-13 middleware: rutas protegidas redirigen a /login cuando no hay
   cookie de sesión. Este spec previene regresión del bug donde middleware.ts
   estaba en raíz (Next.js lo ignoraba por la estructura src/). */

const PROTECTED_PATHS = [
  "/inicio",
  "/caja",
  "/cobrar",
  "/pagar",
  "/gestion",
  "/administracion",
  "/administracion/usuarios",
];

const PUBLIC_PATHS = ["/", "/login", "/recuperar-clave", "/playground", "/aceptar-invitacion"];

test.describe("middleware: rutas protegidas (C0-13)", () => {
  for (const path of PROTECTED_PATHS) {
    test(`GET ${path} sin sesión → 307 a /login?redirect=${path}`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      const location = res.headers()["location"];
      expect(location).toBeDefined();
      expect(location).toContain("/login");
      expect(location).toContain(`redirect=${encodeURIComponent(path)}`);
    });
  }
});

test.describe("middleware: rutas públicas pasan sin redirect (C0-13)", () => {
  for (const path of PUBLIC_PATHS) {
    test(`GET ${path} sin sesión → 200 (no requiere auth)`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status()).toBe(200);
    });
  }
});
