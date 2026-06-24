import { test, expect } from "@playwright/test";

/* Smoke post-deploy contra el stack real (https://app.qavante.com por default).
   Corre en CI tras deploy-cloudflare.yml. Si esto pinta rojo, hay regresión
   en prod aunque el build local pase. Justificación: atajar el "el build
   pasa pero prod no anda" antes de que un usuario lo encuentre.

   Mix de fixtures: `request` (HTTP-only, rápido) para checks de status/headers/
   chunks; `page` (browser, ~30s overhead por chromium install) para checks
   que dependen de hidratación client-side (forms, etc.). */

test.describe("prod smoke — FE alive (HTTP-only)", () => {
  test("GET / responde y, si redirige, va a /inicio (no skeleton C0)", async ({ request }) => {
    /* La raíz redirige a /inicio (`redirect()` en page.tsx). Ojo: el status difiere
       por entorno — Cloudflare/OpenNext emite 307 real (prod), `next start` local lo
       sirve 200. Aceptamos ambos; si redirige, el destino debe ser /inicio. Antes acá
       vivía el skeleton "Sprint C0", que no debe volver. */
    const res = await request.get("/", { maxRedirects: 0 });
    expect([200, 307, 308]).toContain(res.status());
    if (res.status() !== 200) {
      expect(res.headers()["location"]).toContain("/inicio");
    }
  });

  test("GET /login → 200 + bundle de LoginForm cargado", async ({ request }) => {
    const res = await request.get("/login");
    expect(res.status()).toBe(200);
    const body = await res.text();
    // LoginForm es client component (CSR); el HTML del form se hidrata después.
    // Verifico que el chunk del componente se referencie y el title sea el correcto.
    // (La cadena "LoginForm" aparece JSON-escapada dentro del payload self.__next_f.)
    expect(body).toMatch(/<title>Qavante[^<]*<\/title>/);
    expect(body).toContain("static/chunks/app/(auth)/login/page-");
    expect(body).toMatch(/\\"LoginForm\\"/);
  });

  test("ruta protegida sin sesión → 307 a /login (middleware vivo en prod)", async ({
    request,
  }) => {
    const res = await request.get("/inicio", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const location = res.headers()["location"];
    expect(location).toContain("/login");
    expect(location).toContain("redirect=%2Finicio");
  });
});

test.describe("prod smoke — FE alive (browser)", () => {
  test("LoginForm hidrata: inputs RUT/clave + submit visibles", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    // Selectores semánticos (labels + role) — independientes de la implementación
    // del wrapper QavanteInput o de si react-hook-form expone `name` al DOM.
    // exact:true en "Clave" evita match con el aria-label "Mostrar clave" del botón ojo.
    await expect(page.getByLabel("RUT", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel("Clave", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /iniciar sesión/i })).toBeVisible();
  });
});

/* Login flow end-to-end (FE + BE + cookie chain). Habilitar cuando:
   - api.qavante.com esté arriba con cert válido,
   - Backend exponga POST /api/auth/login y GET /api/me,
   - Existan credenciales de smoke (env SMOKE_RUT + SMOKE_PASSWORD).
   Este es el test que efectivamente cubre el problema cookie cross-origin
   discutido en qavante-api#58. */
test.describe("prod smoke — login flow (gated)", () => {
  const hasCreds = !!(process.env.SMOKE_RUT && process.env.SMOKE_PASSWORD);

  test.skip(
    !hasCreds,
    "Sin SMOKE_RUT/SMOKE_PASSWORD — flow login pendiente de BE auth + creds de smoke",
  );

  test("login → cookie qavante_session → GET /api/me devuelve user", async ({ request }) => {
    const apiBase = process.env.SMOKE_API_URL ?? "https://api.qavante.com";

    const loginRes = await request.post(`${apiBase}/api/auth/login`, {
      data: { rut: process.env.SMOKE_RUT, password: process.env.SMOKE_PASSWORD },
    });
    expect(loginRes.status()).toBe(200);

    // Cookie debe llegar con Domain=.qavante.com (parent shared con FE)
    const setCookie = loginRes.headers()["set-cookie"] ?? "";
    expect(setCookie).toMatch(/qavante_session=/);
    expect(setCookie).toMatch(/Domain=\.qavante\.com/i);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);

    // Request autenticado: la cookie debe viajar y el backend debe responder.
    const meRes = await request.get(`${apiBase}/api/me`);
    expect(meRes.status()).toBe(200);
    const me = await meRes.json();
    expect(me.user?.role).toBeDefined();
  });
});
