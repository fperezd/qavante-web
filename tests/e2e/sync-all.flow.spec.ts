import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo de usuario REAL — botón "Actualizar" global del header (patrón Chipax).
   Un clic dispara la traída de SII + banco (POST /api/onboarding/sync) y confirma
   con un toast. MSW sirve el sync ok. */

test.describe("Flujo: Actualizar global (header)", () => {
  test("el botón dispara la sincronización y confirma con toast", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/inicio");

    const actualizar = page.getByRole("button", { name: "Actualizar datos (SII y banco)" });
    await expect(actualizar).toBeVisible();

    await actualizar.click();

    // Confirmación: toast "Actualización iniciada".
    await expect(page.getByText("Actualización iniciada")).toBeVisible();
  });
});
