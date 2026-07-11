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
    // Pagos y obligaciones AGRUPADOS por categoría (eje universal multi-tenant).
    await expect(page.getByText("Pagos y obligaciones")).toBeVisible();
    await expect(page.getByRole("button", { name: /Remuneraciones/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Impuestos/ })).toBeVisible();
    // El grupo de mayor subtotal (Remuneraciones) abre por default; su ítem de
    // nómina se muestra con el label derivado del período ("Remuneraciones — …").
    await expect(page.getByText(/Remuneraciones —/).first()).toBeVisible();
    // Expandir "Impuestos" → aparece su ítem.
    await page.getByRole("button", { name: /Impuestos/ }).click();
    await expect(page.getByText("IVA / F29 mayo")).toBeVisible();
  });

  test("ítem de nómina → drill-down al detalle por empleado (deep-link al período)", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar");

    // Remuneraciones abre por default (mayor subtotal) → su ítem trae el link.
    const detalle = page.getByRole("link", { name: /Ver detalle por empleado/ }).first();
    await expect(detalle).toBeVisible();
    await detalle.click();
    // Deep-link al período del ítem (payroll-202606 → 2026-06).
    await expect(page).toHaveURL(/\/remuneraciones\?period=2026-06/);
  });
});
