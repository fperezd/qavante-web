import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Pagar v2 (rediseño 2026-07-14, `pagarV2` ON en prod y en el env de e2e). Pantalla
   FE-first contra MSW (accounts-payable). Valida la respuesta de dueño (cuánto debe pagar +
   ¿la caja alcanza?), las 3 del mes, los vencimientos y el drill-down al detalle. */

test.describe("Flujo: Pagar v2 (/pagar)", () => {
  test("respuesta de dueño + las 3 del mes + vencimientos + mayores compromisos", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar");

    await expect(page.getByRole("heading", { level: 1, name: "Pagar" })).toBeVisible();

    // Hero "respuesta de dueño": cuánto debe pagar. El total se RECOMPUTA al unificar
    // accounts-payable + maestro RCV compras + BHE (#645), y el fixture MSW de RCV ignora el
    // período (mismos docs por mes) → el monto no es determinístico en el test. Verificamos que
    // el hero renderiza un total en pesos, sin fijar la cifra exacta (en prod no multiplica).
    await expect(page.getByText("La empresa debe pagar")).toBeVisible();
    const totalPagar = page
      .getByText("La empresa debe pagar")
      .locator("xpath=following-sibling::p[1]");
    await expect(totalPagar).toHaveText(/\$[1-9][\d.]*/, { timeout: 5000 });

    // Las 3 del mes (no se postergan): impuestos (F29) + imposiciones (Previred).
    await expect(page.getByText(/no se postergan/i)).toBeVisible();

    // Cajas movibles: vencimientos + mayores compromisos.
    await expect(page.getByText("Por vencer y vencidos")).toBeVisible();
    await expect(page.getByText("Mayores compromisos")).toBeVisible();
    // Postergabilidad (heurística): impuestos/sueldos = No postergable.
    await expect(page.getByText("No postergable").first()).toBeVisible();
  });

  test("drill-down: el pago de sueldos lleva al detalle por empleado del período", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar");

    // El ítem de nómina (source_external_id payroll-202606) es clickeable → deep-link al período.
    const sueldos = page.getByRole("button", { name: /Sueldos junio/ }).first();
    await expect(sueldos).toBeVisible();
    await sueldos.click();
    await expect(page).toHaveURL(/\/remuneraciones\?period=2026-06/);
  });
});
