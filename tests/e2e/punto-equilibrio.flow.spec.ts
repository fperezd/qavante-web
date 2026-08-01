import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Gestión → Punto de equilibrio v2 (redefinido 2026-07-31: dato CONCRETO). El piso = lo que
   gastaste el ÚLTIMO MES CERRADO (MSW: Sueldos + Gastos recurrentes), sin proyección ni %. Gated
   `operationalResult`. */

test.describe("Flujo: Punto de equilibrio v2 (/gestion/punto-equilibrio)", () => {
  test("muestra el piso concreto y la tabla de lo gastado el mes cerrado", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/gestion/punto-equilibrio");

    await expect(
      page.getByRole("heading", { level: 1, name: "Punto de equilibrio" }),
    ).toBeVisible();

    const main = page.locator("#main-content");
    // Hero: piso concreto anclado al mes pasado.
    await expect(
      main.getByText(/Si gastas como el mes pasado, necesitas vender .* para no perder/i),
    ).toBeVisible();

    // Tabla: lo que gastaste el mes cerrado + total a cubrir.
    await expect(main.getByRole("heading", { name: /Lo que gastaste en/i })).toBeVisible();
    await expect(main.getByText("Sueldos")).toBeVisible();
    await expect(main.getByText("Total a cubrir", { exact: true })).toBeVisible();

    // Drill-down por documento (CC-API #786): clic en una línea de costo → sus facturas.
    await main.getByText("Sueldos", { exact: true }).click();
    await expect(main.getByText(/SOCIEDAD DE PROFESIONALES/i)).toBeVisible();
    await expect(main.getByText("34-119")).toBeVisible();
  });
});
