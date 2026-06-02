import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Pagar / cuentas por pagar (Sprint C4). Pantalla FE-first contra MSW,
   gated por `accountsPayable` (ON en el env de e2e). Valida resumen, la alerta
   de relación contra caja, y la tabla de pagos/obligaciones. */

test.describe("Flujo: Pagar (/pagar)", () => {
  test("muestra resumen, alerta de caja y pagos/obligaciones", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar");

    await expect(page.getByRole("heading", { level: 1, name: "Pagar" })).toBeVisible();

    // Resumen (MSW).
    await expect(page.getByText("Total por pagar")).toBeVisible();
    await expect(page.getByText("Próx. 7 días")).toBeVisible();
    // Relación contra caja: el fixture tiene covers_critical=false → alerta.
    await expect(page.getByText(/no alcanza/i)).toBeVisible();
    // Tabla de pagos/obligaciones + una obligación del fixture.
    await expect(page.getByText("Pagos y obligaciones")).toBeVisible();
    await expect(page.getByText("IVA / F29 mayo")).toBeVisible();
  });
});
