import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Remuneraciones (BUK, ADR-0056). Pantalla gated por `remuneraciones`
   (ON en el env de e2e), contra MSW. Valida la Dotación (empleados), la Planilla
   (totales del período + barra de registro a Pagar), y que la Conciliación
   muestre su estado honesto "falta el detalle por empleado" (contrato futuro). */

test.describe("Flujo: Remuneraciones (/remuneraciones)", () => {
  test("Dotación lista empleados, Planilla muestra totales y permite registrar en Pagar", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/remuneraciones");

    await expect(page.getByRole("heading", { level: 1, name: "Remuneraciones" })).toBeVisible();

    // Dotación (tab por defecto): empleados del MSW + búsqueda.
    await expect(page.getByText("Ana Pérez Soto")).toBeVisible();
    await expect(page.getByText("Benjamín Rojas Díaz")).toBeVisible();
    await expect(page.getByText("Contadora")).toBeVisible();

    // Planilla: auto-carga (filtro de rango, mes actual) → totales agregados +
    // detalle por empleado (ADR-0057).
    await page.getByRole("tab", { name: "Planilla" }).click();
    await expect(page.getByText("Líquido a pagar")).toBeVisible();
    await expect(page.getByText("Detalle por empleado")).toBeVisible();
    await expect(page.getByText("Carla Muñoz Vera")).toBeVisible();

    // Barra de registro a Pagar (ADR-0056) + confirmación previa (anti-duplicado).
    await page.getByRole("button", { name: /Registrar en Pagar/ }).click();
    await expect(page.getByRole("dialog", { name: /Confirmar registro en Pagar/i })).toBeVisible();
    await expect(page.getByText(/no se crea una obligación duplicada/i)).toBeVisible();
    await page.getByRole("button", { name: "Registrar", exact: true }).click();
    await expect(page.getByText(/Planilla registrada en Pagar/i)).toBeVisible();
  });

  test("Conciliación cruza el líquido por empleado contra el banco (ADR-0057)", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/remuneraciones");

    // El detalle por empleado (/payroll/detail) alimenta el cruce → resumen.
    await page.getByRole("tab", { name: "Conciliación" }).click();
    await expect(page.getByText(/empleados conciliados/i)).toBeVisible();
    await expect(page.getByText("Ana Pérez Soto")).toBeVisible();
  });
});
