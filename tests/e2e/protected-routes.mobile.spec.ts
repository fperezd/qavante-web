import { test, expect, type BrowserContext } from "@playwright/test";

/* Mobile responsive (Pixel 5: 393x851) para rutas PROTEGIDAS bajo /app/*.
   Complemento de public-routes.mobile.spec.ts — issue #68.

   Wireup:
   - playwright.config.ts setea NEXT_PUBLIC_API_MOCKING=enabled y
     NEXT_PUBLIC_API_URL=http://localhost:3100 en webServer.env. Esas vars
     se inlinean en el build → MswProvider arranca el worker en cada page
     load → requests a *​/api/* son interceptadas (ver ADR-0005).
   - Para evitar el flow real de login (lento y depende del UI), seteamos
     la cookie `qavante_session` directamente (la valida el middleware como
     "logueado") + opcionalmente `qavante_test_role` para que session.ts
     devuelva el role pedido (gated por NODE_ENV !== production). */

const BASE_URL = "http://localhost:3100";

type TestRole = "owner" | "admin" | "viewer" | "accountant";

async function loginAs(context: BrowserContext, role?: TestRole): Promise<void> {
  const cookies = [{ name: "qavante_session", value: "msw-mock-token", url: BASE_URL }];
  if (role) {
    cookies.push({ name: "qavante_test_role", value: role, url: BASE_URL });
  }
  await context.addCookies(cookies);
}

test.describe("Mobile (Pixel 5) — rutas protegidas /app/*", () => {
  test("/app/inicio renderea heading sin overflow horizontal", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/inicio");

    await expect(page.getByRole("heading", { level: 1, name: "Inicio Ejecutivo" })).toBeVisible();

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflows).toBe(false);
  });

  test("/app/administracion/usuarios renderea heading + tabla en mobile", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/administracion/usuarios");

    /* La tabla puede tener overflow horizontal controlado (scroll en el
       contenedor de la tabla). Validamos heading + estado de carga termina,
       no chequeo de overflow total (TanStack table en mobile suele scroll
       horizontalmente — esperado).  */
    await expect(page.getByRole("heading", { level: 1, name: "Usuarios" })).toBeVisible();
    await page.waitForLoadState("networkidle");
  });

  test("/app/administracion/credenciales renderea bloque SII + lista certificados en mobile", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/administracion/credenciales");

    await expect(page.getByRole("heading", { level: 1, name: "Credenciales SII" })).toBeVisible();

    /* Esperamos el fetch GET /api/admin/sources/sii_rcv/credential vía MSW;
       sin networkidle el card puede mostrarse antes que la data arrive. */
    await page.waitForLoadState("networkidle");

    /* Modelo Opción A (post-#140): UN bloque SII (`SiiCredentialCard` con
       header "Credencial SII" o human_label del seed) + sección
       "Certificados digitales" (multi-holder, lista). NO hay "personas
       autorizadas" — ese concepto fue removido en la migración Opción A
       (regla 16: no inventar `persons[]`). */
    await expect(
      page.getByRole("heading", { level: 2, name: "Certificados digitales" }),
    ).toBeVisible();
    /* Header del SiiCredentialCard — viene del human_label del seed MSW
       ("Clave del SII") o cae al fallback "Credencial SII" si el backend
       no devuelve human_label. */
    await expect(page.getByText(/clave del sii|credencial sii/i).first()).toBeVisible();
    /* Botón del SiiCredentialCard: "Configurar" (sin sufijo) cuando
       `is_active=false` — el estado inicial del seed MSW — o "Cambiar
       clave" cuando active=true. Match anclado para no atrapar otros
       botones (ej. "Cancelar"). */
    await expect(page.getByRole("button", { name: /^(configurar|cambiar clave)$/i })).toBeVisible();

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflows).toBe(false);
  });

  test("sidebar gate: role viewer NO ve módulo Administración", async ({ page, context }) => {
    await loginAs(context, "viewer");
    await page.goto("/inicio");

    /* <aside aria-label="..."> tiene role implícito complementary; el <nav>
       interno no tiene aria-label propio. Filtramos los links dentro del
       complementary container para no atrapar links del header / breadcrumbs. */
    await page.getByRole("button", { name: "Abrir menú" }).click();
    const sidebar = page.getByRole("complementary", { name: "Navegación principal" });

    /* Módulos esperados para viewer: Inicio, Caja, Cobrar, Pagar, Gestión.
       Administración NO debe aparecer (ADMIN_ROLES = [owner, admin, technical_admin]). */
    await expect(sidebar.getByRole("link", { name: "Inicio" })).toBeAttached();
    await expect(sidebar.getByRole("link", { name: "Caja" })).toBeAttached();
    await expect(sidebar.getByRole("link", { name: "Administración" })).toHaveCount(0);
  });

  test("sidebar hamburger: owner abre y cierra el drawer mobile", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/inicio");

    const openButton = page.getByRole("button", { name: "Abrir menú" });
    await expect(openButton).toBeVisible();

    /* La aside togglea con translate-x. Playwright considera "visible" los
       nodos con translate (tienen bounding rect, sólo off-screen). El check
       robusto es la x del bounding rect: -240px cerrado vs 0 abierto.
       Helper inline porque solo se usa acá. */
    async function asideLeftX(): Promise<number> {
      return await page.evaluate(() => {
        const aside = document.querySelector('aside[aria-label="Navegación principal"]');
        return aside ? (aside as HTMLElement).getBoundingClientRect().x : Number.NaN;
      });
    }

    /* Estado inicial: aside fuera de pantalla. */
    expect(await asideLeftX()).toBeLessThan(0);

    /* Abrir → aside entra. Esperamos a que la transición CSS termine
       (200-300ms típicamente con Tailwind transition-transform). */
    await openButton.click();
    await page.waitForFunction(() => {
      const aside = document.querySelector('aside[aria-label="Navegación principal"]');
      return aside ? (aside as HTMLElement).getBoundingClientRect().x >= 0 : false;
    });

    /* Owner ve el módulo Administración (verificación del gate al revés
       respecto del test anterior). */
    const sidebar = page.getByRole("complementary", { name: "Navegación principal" });
    await expect(sidebar.getByRole("link", { name: "Administración" })).toBeAttached();

    /* Cerrar con X interno. */
    await page.getByRole("button", { name: "Cerrar menú" }).click();
    await page.waitForFunction(() => {
      const aside = document.querySelector('aside[aria-label="Navegación principal"]');
      return aside ? (aside as HTMLElement).getBoundingClientRect().x < 0 : false;
    });
  });
});
