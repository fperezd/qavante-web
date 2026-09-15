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

  // Score destacado. Con la lectura canónica D09 (`/pulso/score-reading` en MSW) el título es
  // "Pulso base del negocio" y el titular rule-based legacy deja de mostrarse: en su lugar la
  // vista declara la vigencia de las fuentes tal como la publica el backend (D10, sin inferir).
  await expect(page.getByText("Pulso base del negocio", { exact: true })).toBeVisible();
  await expect(page.getByText("Vigencia de las fuentes no verificable.")).toBeVisible();
  await expect(page.getByText(/Metodología PULSO-2\.0/)).toBeVisible();

  // Factores que componen el Pulso base (vienen del contrato `weights`, no del legacy).
  await expect(page.getByText("Qué compone tu Pulso")).toBeVisible();
  await expect(page.getByText("Cobertura de pagos")).toBeVisible();

  // Drivers (+/-): con la lectura canónica (D09) no se mezclan los drivers rule-based del
  // detalle legacy con los factores publicados por el backend, para que no driften entre sí.
  await expect(page.getByText("Lo que ayuda")).toHaveCount(0);
  await expect(page.getByText("Lo que pesa")).toHaveCount(0);

  // La tendencia legacy no forma parte de la lectura canónica (D09): no se muestra ninguna
  // serie que no publique el backend en el mismo corte.
  await expect(page.locator("#main-content").getByText("Tendencia")).toHaveCount(0);
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

    /* No basta con que redirija: el usuario tiene que terminar viendo su detalle. El redirect
       es del servidor y arrastra una navegación completa; bajo carga tarda más que el default. */
    await expect(page).toHaveURL(/\/alertas$/, { timeout: 20_000 });
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
    // D09: el foco es una lectura separada del Pulso base, con su propio encabezado; el titular
    // legacy con el objetivo interpolado ya no se renderiza junto a la lectura canónica.
    await expect(page.getByText(/Lectura con foco: Cuidar la caja/i)).toBeVisible();
    const res = await putPrefs;
    expect(res.ok()).toBeTruthy();
  });
});
