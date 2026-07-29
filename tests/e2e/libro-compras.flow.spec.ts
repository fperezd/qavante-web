import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Libro de Compras (/pagar/facturas-recibidas). RCV Compras del SII (gated
   `siiQueries`, ON en e2e) contra MSW. Auto-carga por período; valida el header y que
   carguen los documentos de compra por proveedor. Ejercita la vista del Libro (donde
   viven los comparativos del ritmo, #614). */

test.describe("Flujo: Libro de Compras (/pagar/facturas-recibidas)", () => {
  test("carga los documentos de compra del SII por proveedor", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar/facturas-recibidas");

    await expect(page.getByRole("heading", { name: "Facturas de compra" })).toBeVisible();
    await expect(page.getByText("Proveedor SpA").first()).toBeVisible();
    await expect(page.getByText("Insumos Chile Ltda").first()).toBeVisible();
  });
});
