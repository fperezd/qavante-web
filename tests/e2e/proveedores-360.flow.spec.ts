import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Gestión → Proveedores 360 (pedido de Fernando 2026-07-30, simétrico al de clientes).
   Comportamiento de compra con un proveedor en el tiempo desde el RCV compras (MSW sirve Proveedor
   SpA / Insumos Chile). Estructura, no montos. Gated `operationalResult`. */

test.describe("Flujo: Proveedores 360 (/gestion/proveedores)", () => {
  test("muestra el selector y los bloques de análisis del proveedor", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/gestion/proveedores");

    await expect(page.getByRole("heading", { level: 1, name: "Proveedores 360" })).toBeVisible();

    const main = page.locator("#main-content");
    await expect(main.getByText("Elige un proveedor")).toBeVisible();
    await expect(main.getByText("Compras mes a mes (últimos 24 meses)")).toBeVisible();
    await expect(main.getByRole("heading", { name: "Estacionalidad" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Últimos documentos" })).toBeVisible();
    // Días de pago real: honesto, pendiente CC-API.
    await expect(main.getByText(/Días promedio en pagar .* en preparación/i)).toBeVisible();
  });
});
