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
    await expect(page.getByText("Total haberes")).toBeVisible();
    await expect(page.getByText("Líquido a pagar")).toBeVisible();
    // Impuesto de remuneraciones (IUSC) — viene del F29 (/sii/f29/impuesto), NO del payroll.
    await expect(page.getByText("Impuestos (F29)")).toBeVisible();
    await expect(page.getByText("$618.000")).toBeVisible();
    await expect(page.getByText("Detalle por empleado")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Haberes" })).toBeVisible();
    // Costo empresa por trabajador (dato real de BUK: líquido + leyes sociales).
    await expect(page.getByRole("columnheader", { name: "Costo empresa" })).toBeVisible();
    await expect(page.getByText("Carla Muñoz Vera")).toBeVisible();

    // Barra de registro a Pagar (ADR-0056) + confirmación previa (anti-duplicado).
    await page.getByRole("button", { name: /Registrar en Pagar/ }).click();
    await expect(page.getByRole("dialog", { name: /Confirmar registro en Pagar/i })).toBeVisible();
    await expect(page.getByText(/no se crea una obligación duplicada/i)).toBeVisible();
    await page.getByRole("button", { name: "Registrar", exact: true }).click();
    await expect(page.getByText(/Planilla registrada en Pagar/i)).toBeVisible();
  });

  test("Conciliación accionable: desasignar el match malo y asignar un débito (#835)", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    // Deep-link fija el período en 2026-05 (donde vive el débito de sueldos del fixture).
    await page.goto("/remuneraciones?period=2026-05");
    await page.getByRole("tab", { name: "Conciliación" }).click();

    // Board accionable (flag payrollReconcileBoard ON en e2e): zona de conciliar + Conciliados.
    await expect(page.getByRole("heading", { name: "Conciliar sueldos" })).toBeVisible();

    // Caso real del #835: Carrasco quedó conciliado contra una transferencia a Fernando Pérez →
    // Desasignar lo deshace.
    const carrasco = page.getByRole("row", { name: /TRANSFERENCIA A FERNANDO PEREZ/ });
    await expect(carrasco).toBeVisible();
    await carrasco.getByRole("button", { name: /Desasignar/ }).click();
    await expect(page.getByText(/Match desasignado/i)).toBeVisible();
    await expect(page.getByText("TRANSFERENCIA A FERNANDO PEREZ")).toHaveCount(0);

    // Asignar bien: elige el débito de sueldos + marca a Ana → Conciliar → Confirmar.
    await page.getByRole("radio", { name: /SUELDO FERNANDO PEREZ MAYO/ }).click();
    await page.getByRole("checkbox", { name: /Ana P/ }).click();
    await page.getByRole("button", { name: /^Conciliar$/ }).click();
    await expect(page.getByText(/Asignar/)).toBeVisible();
    await page.getByRole("button", { name: /Confirmar conciliación/ }).click();

    // Refetch del board → toast + Ana pasa a Conciliados (fila con su Desasignar).
    await expect(page.getByText(/Sueldo conciliado/i)).toBeVisible();
    const anaConciliada = page.getByRole("row", { name: /Ana P/ });
    await expect(anaConciliada.getByRole("button", { name: /Desasignar/ })).toBeVisible();
  });
});
