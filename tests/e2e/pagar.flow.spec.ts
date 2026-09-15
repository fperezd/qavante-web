import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Producción publica V05 antes de V2 (`pagarV05=true` en wrangler.toml y en el entorno E2E).
   Se valida la fuente canónica de cuentas por pagar, sus vencimientos y los límites explícitos
   de acción humana de V05; no una variante V2 que esos mismos flags no montan. */

test.describe("Flujo: Pagar V05 de producción (/pagar)", () => {
  test("publica vencidos, horizonte de 14 días y pagos no postergables", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar");

    await expect(page.getByRole("heading", { level: 1, name: "Pagar" })).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Vencido, por pagar y caja proyectada" }),
    ).toBeVisible();
    const resumen = page.getByRole("region", { name: "Vencido, por pagar y caja proyectada" });
    await expect(resumen).toContainText("Por pagar");
    await expect(resumen).toContainText("14 días");
    await expect(resumen).toContainText("$6.200.000");
    await expect(page.getByRole("radio", { name: "14 días" })).toBeChecked();
    const pagos = page.getByRole("region", { name: "Pagos y obligaciones" });
    await expect(pagos).toBeVisible();
    await expect(pagos.getByText("Remuneraciones: Junio 2026").first()).toBeVisible();
    await expect(page.getByText("No se posterga").first()).toBeVisible();
    await expect(page.getByText("La empresa debe pagar")).toHaveCount(0);
  });

  test("declara que no ejecuta pagos masivos ni posterga automáticamente", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar");

    await expect(page.getByText("No existe un botón “pagar todo”")).toBeVisible();
    await expect(
      page.getByText("Impuestos y sueldos jamás entran en postergaciones automáticas."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /pagar todo/i })).toHaveCount(0);
  });
});
