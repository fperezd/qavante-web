import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Libro de Ventas (/cobrar/facturas-emitidas). RCV Ventas del SII (gated
   `siiQueries`, ON en e2e) contra MSW. Auto-carga por período; valida el header y que
   carguen los documentos de venta por cliente. */

test.describe("Flujo: Libro de Ventas (/cobrar/facturas-emitidas)", () => {
  test("carga los documentos de venta del SII por cliente", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/cobrar/facturas-emitidas");

    await expect(page.getByRole("heading", { name: "Libro de Ventas" })).toBeVisible();
    await expect(page.getByText("Cliente A SA").first()).toBeVisible();
    await expect(page.getByText("Cliente B Ltda").first()).toBeVisible();
  });
});
