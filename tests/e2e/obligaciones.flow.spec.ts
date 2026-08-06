import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Compras a plazo, préstamos y obligaciones (/pagar/obligaciones). Tesorería (gated
   `obligations`, ON en el env de e2e) contra MSW. Valida el header + que liste las obligaciones del
   fixture por acreedor, y —regla UX "todo clickeable a detalle"— que una abra su detalle. */

test.describe("Flujo: Compras a plazo, préstamos y obligaciones", () => {
  test("lista las obligaciones por acreedor y abre el detalle", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar/obligaciones");

    await expect(
      page.getByRole("heading", { name: "Compras a plazo, préstamos y obligaciones" }),
    ).toBeVisible();
    const bice = page.getByText("Banco BICE").first();
    await expect(bice).toBeVisible();
    await expect(page.getByText("Leasing Andes").first()).toBeVisible();
    // Las compras a plazo (SII/TGR/proveedores en cuotas) NO se etiquetan "préstamo".
    await expect(page.getByText("SII").first()).toBeVisible();
    await expect(page.getByText(/Compra a plazo/).first()).toBeVisible();

    // Clickeable a detalle: abrir el préstamo lleva a su ficha (/pagar/obligaciones/<id>).
    await bice.click();
    await expect(page).toHaveURL(/\/pagar\/obligaciones\/obl-/);
  });
});
