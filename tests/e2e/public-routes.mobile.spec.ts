import { test, expect } from "@playwright/test";

/* Mobile responsive smoke (Pixel 5 viewport: 393x851).
   Cubre hallazgo K.4 #3 del audit de Milestone D — "Visual mobile/
   responsive no validado automatizado".

   Scope: SOLO rutas públicas (sin auth). Las rutas /app/* requieren
   cookie + MSW para que el middleware deje pasar, lo que añade
   complejidad — diferido hasta un spec dedicado de admin mobile cuando
   exista PR que integre MSW con Playwright. */

test.describe("Mobile (Pixel 5) — rutas públicas", () => {
  test("/login renderea sin overflow horizontal + form visible", async ({ page }) => {
    await page.goto("/login");

    /* Form principal visible (no escondido bajo header / overflow).
       getByLabel("Clave") es ambiguo (el botón "Mostrar clave" del eye
       icon también tiene aria-label) — usamos role específico. */
    await expect(page.getByLabel("RUT")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Clave" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();

    /* No overflow horizontal: documentElement.scrollWidth no debe exceder
       el viewport width. */
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflows).toBe(false);
  });

  test("/recuperar-clave renderea bien en mobile", async ({ page }) => {
    await page.goto("/recuperar-clave");
    /* Heading principal visible. */
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflows).toBe(false);
  });

  test("/aceptar-invitacion renderea bien en mobile (con token query)", async ({ page }) => {
    await page.goto("/aceptar-invitacion?token=demo-mobile-test");
    /* La ruta usa Suspense + useSearchParams. Esperamos a que la
       hidratación termine (network idle) en vez de buscar texto
       específico — el form puede renderear con o sin MSW activo. */
    await page.waitForLoadState("networkidle");
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflows).toBe(false);
  });

  test("/playground renderea componentes capa 1 en mobile", async ({ page }) => {
    await page.goto("/playground");
    /* La página tiene varios componentes Qavante demo. Validamos que
       al menos el heading aparece + no hay overflow horizontal. */
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflows).toBe(false);
  });
});
