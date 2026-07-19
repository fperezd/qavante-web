import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Compras al extranjero (/caja/compras-extranjero). Movimientos en moneda
   extranjera de la cartola de tarjeta, para clasificar (gated `bankMovementClassification`,
   ON en e2e). Valida que la pantalla renderice su vista (no el placeholder) sin errores. */

test.describe("Flujo: Compras al extranjero (/caja/compras-extranjero)", () => {
  test("renderiza la pantalla de compras en moneda extranjera", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/caja/compras-extranjero");

    await expect(page.getByRole("heading", { name: "Compras al extranjero" })).toBeVisible();
    // La vista (no el FeatureUnavailableState) — el subtítulo de la pantalla real.
    await expect(page.getByText(/moneda extranjera/i).first()).toBeVisible();
  });
});
