import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Gestión → Punto de equilibrio v2 (pedido de Fernando 2026-07-30). Toma las líneas de
   costo recurrentes del breakdown por cuenta (MSW: Sueldos + Gastos recurrentes) y proyecta lo que
   hay que cubrir el próximo mes → cuánto vender. Gated `operationalResult`. */

test.describe("Flujo: Punto de equilibrio v2 (/gestion/punto-equilibrio)", () => {
  test("muestra el piso de venta y la tabla de costos recurrentes a cubrir", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/gestion/punto-equilibrio");

    await expect(
      page.getByRole("heading", { level: 1, name: "Punto de equilibrio" }),
    ).toBeVisible();

    const main = page.locator("#main-content");
    // Hero: el piso de venta para cubrir los costos.
    await expect(
      main.getByText(/Necesitas vender .* al mes para cubrir tus costos/i),
    ).toBeVisible();

    // Tabla de costos recurrentes con su total.
    await expect(main.getByRole("heading", { name: "Costos recurrentes a cubrir" })).toBeVisible();
    await expect(main.getByText("Sueldos")).toBeVisible();
    await expect(main.getByText("Total a cubrir (próximo mes)")).toBeVisible();
  });
});
