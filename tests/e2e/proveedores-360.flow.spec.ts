import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Gestión → Proveedores 360 (pedido de Fernando 2026-07-30, simétrico al de clientes).
   Comportamiento de compra con un proveedor en el tiempo desde el RCV compras (MSW sirve Proveedor
   SpA / Insumos Chile) y reconcilia monto y documentos del contrato contenido. */

test.describe("Flujo: Proveedores 360 (/gestion/proveedores)", () => {
  test("muestra el selector y los bloques de análisis del proveedor", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/gestion/proveedores");

    await expect(page.getByRole("heading", { level: 1, name: "Proveedores 360" })).toBeVisible();

    const main = page.locator("#main-content");
    await expect(main.getByText("Busca un proveedor por nombre o RUT")).toBeVisible();
    await expect(main.getByText("Compras por mes observado (12)")).toBeVisible();
    await expect(main.getByText(/tendencia|estacionalidad/i)).toHaveCount(0);
    await expect(main.getByRole("heading", { name: "Últimos documentos" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Insumos Chile Ltda" })).toBeVisible();
    await expect(
      main.getByText("Compras (12 meses observados)", { exact: true }).locator(".."),
    ).toContainText("$17.136.000");
    await expect(main.getByText("Documentos", { exact: true }).locator("..")).toContainText("12");
    await expect(main.getByText(/12\/12 meses respondieron/)).toBeVisible();
    // Días de pago real: honesto, pendiente CC-API.
    await expect(main.getByText(/Días promedio en pagar.*no disponible/i)).toBeVisible();
  });
});
