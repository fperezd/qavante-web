import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Gestión → Comparativo (las 5 comparaciones potentes). Verifica los bloques clave,
   incluido "Vs. tu promedio" que ahora muestra el VALOR del promedio 12m y del mismo mes del año
   anterior (pedido de Fernando), no solo el %. Contra MSW (operational-result + breakdown).
   Gated `operationalResult`. */

test.describe("Flujo: Comparativo (/gestion/comparativo)", () => {
  test("muestra los bloques y las referencias con valor en 'Vs. tu promedio'", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/gestion/comparativo");

    await expect(page.getByRole("heading", { level: 1, name: "Comparativo" })).toBeVisible();

    const main = page.locator("#main-content");
    await expect(main.getByRole("heading", { name: "Este mes" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Acumulado del año" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Vs. tu promedio" })).toBeVisible();

    // Todas las comparaciones llevan la REFERENCIA CON MONTO (no solo %): "Este mes" (vs mes/año
    // anterior), "Acumulado" y "Vs. tu promedio". El monto ($) va dentro de la línea de referencia.
    await expect(main.getByText("vs mes anterior").first()).toBeVisible();
    await expect(main.getByText("promedio 12m").first()).toBeVisible();
    await expect(main.getByText(/mismo mes 20\d{2}/).first()).toBeVisible();
  });
});
