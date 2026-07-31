import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Gestión → Clientes 360 (pedido de Fernando 2026-07-30). Analiza el comportamiento
   comercial de un cliente en el tiempo desde el RCV ventas (MSW sirve Cliente A/B). Se afirma la
   ESTRUCTURA (selector + bloques), no montos (dependen del fixture). Gated `operationalResult`. */

test.describe("Flujo: Clientes 360 (/gestion/clientes)", () => {
  test("muestra el selector y los bloques de análisis de la contraparte", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/gestion/clientes");

    await expect(page.getByRole("heading", { level: 1, name: "Clientes 360" })).toBeVisible();

    const main = page.locator("#main-content");
    // Selector de cliente (default = el que más pesa).
    await expect(main.getByText("Elige un cliente")).toBeVisible();

    // Bloques del 360 (strings completos y únicos).
    await expect(main.getByText("Ventas mes a mes (últimos 24 meses)")).toBeVisible();
    await expect(main.getByText("Estacionalidad")).toBeVisible();
    await expect(main.getByText("Últimos documentos")).toBeVisible();
    // Los "días de pago real" se declaran honestos como pendientes.
    await expect(main.getByText(/Días promedio .* en preparación/i)).toBeVisible();
  });
});
