import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Inicio (/inicio), V01 activo en producción. Valida tres cosas a la vez: que el saldo
   conserve su fuente y su frescura; que la decisión de caja venga del run canónico H=14 con
   saldo final, mínimo y brecha contra cero como hechos DISTINTOS del servidor (nunca la resta
   legacy obligaciones−caja); y que una proyección que no llegó se presente como "sin dato" con
   una salida útil, jamás como $0. */

test.describe("Flujo: Inicio (/inicio)", () => {
  test("publica el run canónico H=14 y declara honestamente la proyección pendiente", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/inicio");

    await expect(page.getByRole("heading", { level: 1, name: "Inicio" })).toBeVisible();
    await expect(page.getByText("$9.800.000").first()).toBeVisible();
    await expect(page.getByText("CLP · Resumen financiero")).toBeVisible();
    await expect(page.getByText(/Banco actualizado hace \d+ días/)).toBeVisible();

    const panel = page.locator("[data-projection-run]").first();
    await expect(panel.getByText(/14 días · CLP/)).toBeVisible();
    await expect(panel.getByText("Saldo final")).toBeVisible();
    await expect(panel.getByText(/Mínimo · 2026-09-12/)).toBeVisible();
    await expect(panel.getByText("Brecha contra cero")).toBeVisible();
    await expect(page.getByText(/Te faltan \$1\.200\.000/)).toHaveCount(0);

    const projection = page.getByRole("region", { name: "Faltante proyectado" });
    await expect(projection.getByText("Sin dato", { exact: true })).toBeVisible();
    await expect(projection.getByText("Proyección pendiente de actualizar.")).toBeVisible();
    await projection.getByRole("link", { name: "Ver flujo de caja" }).click();
    await expect(page).toHaveURL(/\/caja$/);
  });
});
