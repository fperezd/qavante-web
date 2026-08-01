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

    // El mes va EN CURSO (el MSW lo marca proforma): "Este mes" NO compara parcial vs completo (peras
    // con manzanas). Muestra el mes anterior COMPLETO como referencia + la card "Ventas al mismo tramo"
    // (la comparación pareja, del RCV diario) — pedido de Fernando 2026-08-01.
    await expect(main.getByRole("heading", { name: "Ventas al mismo tramo" })).toBeVisible();
    await expect(main.getByText(/completo/i).first()).toBeVisible();
    await expect(main.getByText(/mismo tramo de/i).first()).toBeVisible();

    // Los otros bloques siguen con su referencia CON MONTO (no solo %).
    await expect(main.getByText("promedio 12m").first()).toBeVisible();
    await expect(main.getByText(/mismo mes 20\d{2}/).first()).toBeVisible();
  });
});
