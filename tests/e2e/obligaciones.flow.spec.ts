import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Préstamos y obligaciones (/pagar/obligaciones). Tesorería (gated `obligations`,
   ON en el env de e2e) contra MSW. Valida el header + que liste los préstamos del fixture
   por acreedor, y —regla UX "todo clickeable a detalle"— que un préstamo abra su detalle. */

test.describe("Flujo: Préstamos y obligaciones", () => {
  test("lista los préstamos por acreedor y abre el detalle", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar/obligaciones");

    await expect(page.getByRole("heading", { name: "Préstamos y obligaciones" })).toBeVisible();
    const bice = page.getByText("Banco BICE").first();
    await expect(bice).toBeVisible();
    await expect(page.getByText("Leasing Andes").first()).toBeVisible();

    // Clickeable a detalle: abrir el préstamo lleva a su ficha (/pagar/obligaciones/<id>).
    await bice.click();
    await expect(page).toHaveURL(/\/pagar\/obligaciones\/obl-/);
  });
});
