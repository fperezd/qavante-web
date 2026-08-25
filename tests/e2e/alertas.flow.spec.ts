import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Alertas (antes "Pulso detalle", Sprint C6/C7). La vista se renombró a `/alertas` y
   `/gestion/pulso` quedó como redirección de compatibilidad; el motor backend (`dashboard_pulso`)
   es el mismo. Pantalla construida FE-first contra MSW, gated por `pulsoDetail` (ON en el env de
   e2e). Valida render del score + ejes + drivers + tendencia, y que la ruta vieja siga llevando
   al usuario a la vista (no sólo que redirija: que el contenido esté ahí al llegar). */

/** Contenido que el dueño tiene que ver al llegar, venga por la ruta nueva o por la vieja. */
async function esperarDetalleDeAlertas(page: import("@playwright/test").Page) {
  await expect(page.getByRole("heading", { level: 1, name: "Alertas" })).toBeVisible();

  // Score destacado + headline rule-based (datos de MSW).
  await expect(page.getByText("Pulso del negocio")).toBeVisible();
  await expect(page.getByText(/la cobranza más lenta lo frena/i)).toBeVisible();

  // Ejes que componen el índice.
  await expect(page.getByText("Qué compone tu Pulso")).toBeVisible();
  await expect(page.getByText("Liquidez")).toBeVisible();

  // Drivers (+/-).
  await expect(page.getByText("Lo que ayuda")).toBeVisible();
  await expect(page.getByText("Lo que pesa")).toBeVisible();
  await expect(page.getByText("Cobranza lenta")).toBeVisible();

  // Tendencia (scopeado al contenido: el sidebar tiene un link "Tendencia" —sub-ítem de
  // Gestión— que también matchea el texto).
  await expect(page.locator("#main-content").getByText("Tendencia")).toBeVisible();
}

test.describe("Flujo: Alertas (/alertas)", () => {
  test("muestra score, ejes, drivers y tendencia", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/alertas");

    await esperarDetalleDeAlertas(page);
  });

  test("la ruta vieja /gestion/pulso deja al usuario en Alertas con el detalle a la vista", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/gestion/pulso");

    // No basta con que redirija: el usuario tiene que terminar viendo su detalle.
    await expect(page).toHaveURL(/\/alertas$/);
    await esperarDetalleDeAlertas(page);
  });

  test("elegir un objetivo re-pondera el Pulso y persiste el foco", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/alertas");

    // El selector de objetivo (flag `pulsoObjetivo` ON en e2e); arranca en "Equilibrado".
    await expect(page.getByText(/Con qué foco quieres mirar tu salud/i)).toBeVisible();
    await expect(page.getByRole("radio", { name: "Equilibrado" })).toBeChecked();

    // Elegir "Cuidar la caja" → el Pulso se pide con ?objetivo=cuidar_caja y el backend (MSW) devuelve
    // la respuesta con el foco aplicado; y el foco se PERSISTE (PUT /api/me/preferences).
    const putPrefs = page.waitForResponse(
      (r) => r.url().includes("/api/me/preferences") && r.request().method() === "PUT",
    );
    await page.getByRole("radio", { name: "Cuidar la caja" }).click();
    await expect(page.getByText(/foco en cuidar la caja/i)).toBeVisible();
    await expect(page.getByText(/Foco: cuidar_caja/)).toBeVisible();
    const res = await putPrefs;
    expect(res.ok()).toBeTruthy();
  });
});
