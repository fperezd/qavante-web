import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Obligaciones en cuotas (/pagar/obligaciones). Tesorería (gated `obligations`, ON en el env
   de e2e) contra MSW. Valida el header + que liste las obligaciones del fixture por acreedor (incluida
   una compra a plazo que NO se lee como préstamo), y —regla UX "todo clickeable a detalle"— el detalle. */

test.describe("Flujo: Obligaciones en cuotas", () => {
  test("lista las obligaciones por acreedor y abre el detalle", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar/obligaciones");

    await expect(page.getByRole("heading", { name: "Obligaciones en cuotas" })).toBeVisible();
    const bice = page.getByText("Banco BICE").first();
    await expect(bice).toBeVisible();
    await expect(page.getByText("Leasing Andes").first()).toBeVisible();
    // La compra a plazo (SII, `card_purchase`) aparece por su acreedor con sus cuotas, NO como préstamo
    // ni con el tipo crudo.
    await expect(page.getByText("SII").first()).toBeVisible();
    await expect(page.getByText("card_purchase")).toHaveCount(0);

    // Clickeable a detalle: abrir una obligación lleva a su ficha (/pagar/obligaciones/<id>).
    await bice.click();
    await expect(page).toHaveURL(/\/pagar\/obligaciones\/obl-/);
  });
});
