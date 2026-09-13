import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Inicio V01 activo en producción. Valida que el saldo conserve su fuente y frescura, y que una
   proyección no disponible se presente como dato pendiente con una salida útil. */

test.describe("Flujo: Inicio (/inicio)", () => {
  test("muestra saldo con contexto y declara honestamente la proyección pendiente", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/inicio");

    await expect(page.getByRole("heading", { level: 1, name: "Inicio" })).toBeVisible();
    await expect(page.getByText("$9.800.000").first()).toBeVisible();
    await expect(page.getByText("CLP · Resumen financiero")).toBeVisible();
    await expect(page.getByText(/Banco actualizado hace \d+ días/)).toBeVisible();

    const projection = page.getByRole("region", { name: "Faltante proyectado" });
    await expect(projection.getByText("Sin dato", { exact: true })).toBeVisible();
    await expect(projection.getByText("Proyección pendiente de actualizar.")).toBeVisible();
    await projection.getByRole("link", { name: "Ver flujo de caja" }).click();
    await expect(page).toHaveURL(/\/caja$/);
  });
});
