import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Caja v2 (rediseño 2026-07-14, `cajaV2` ON en prod y en el env de e2e). La vista LIVE
   deriva la curva de saldo del saldo de hoy (dashboard) + los netos del reporte de caja (MSW),
   con la caja mínima como piso. Cubre la respuesta de dueño + el saldo hoy + los flujos. */

test.describe("Flujo: Caja v2 (/caja/proyeccion)", () => {
  test("respuesta de dueño + saldo hoy + curva + flujos por período", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/caja/proyeccion");

    await expect(page.getByRole("heading", { level: 1, name: "Caja proyectada" })).toBeVisible();

    // Hero "respuesta de dueño": saldo de hoy (cash_today del fixture = $9.800.000).
    await expect(page.getByText("La empresa tiene en caja")).toBeVisible();
    await expect(page.getByText("$9.800.000")).toBeVisible();

    // Saldo disponible (degradado a total: bice/saldo es api-key-only).
    await expect(page.getByText("Total en caja hoy")).toBeVisible();

    // La curva de saldo proyectado + la tabla de entradas/salidas por período.
    await expect(page.getByText("Saldo proyectado")).toBeVisible();
    await expect(page.getByText("Entradas y salidas · por período")).toBeVisible();
    // Columna derivada que la tabla clásica no tiene.
    await expect(page.getByText("Saldo al cierre")).toBeVisible();
  });
});
