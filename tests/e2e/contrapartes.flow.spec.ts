import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — submenús de contrapartes (2026-07-20): Cobrar → Clientes, Pagar →
   Proveedores / Honorarios. Cada sub-ruta muestra TODOS los del año (RCV/BHE del
   SII, no solo lo pendiente) con el vencimiento derivado (emisión + término
   editable). Gated por siiQueries (ON en e2e). Datos de MSW. */

test.describe("Flujo: submenús de contrapartes", () => {
  test("Cobrar → Clientes (/cobrar/clientes)", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/cobrar/clientes");
    await expect(page.getByRole("heading", { level: 1, name: "Clientes" })).toBeVisible();
    await expect(page.getByText(/Todos los clientes con ventas registradas/)).toBeVisible();
    await expect(page.getByText("Cliente A SA").first()).toBeVisible();
    // Término editable por cliente.
    await expect(page.getByLabel(/Término de pago de Cliente A SA/).first()).toBeVisible();
    // Expandir el cliente → detalle de documentos con "marcar conciliado" por factura.
    await page.getByRole("button", { name: /Cliente A SA/ }).first().click();
    await expect(page.getByRole("button", { name: "Marcar conciliado" }).first()).toBeVisible();
  });

  test("Pagar → Proveedores (/pagar/proveedores)", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar/proveedores");
    await expect(page.getByRole("heading", { level: 1, name: "Proveedores" })).toBeVisible();
    await expect(page.getByText("Proveedor SpA").first()).toBeVisible();
  });

  test("Pagar → Honorarios (/pagar/honorarios)", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar/honorarios");
    await expect(page.getByRole("heading", { level: 1, name: "Honorarios" })).toBeVisible();
    await expect(page.getByText("Profesional Asesor 1").first()).toBeVisible();
  });
});
