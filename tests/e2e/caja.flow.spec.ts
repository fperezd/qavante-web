import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Caja v2+v3 (`cajaV2`/`cajaV3` ON en prod y en el env de e2e). La vista LIVE muestra la
   respuesta de dueño (hero + saldo hoy), el MEDIDOR de días de caja (Caja v3, derivado de la
   proyección del backend) y la tabla de entradas/salidas por período. Cubre esos tres. El flujo de
   conciliar fila-por-fila desde el caveat vive en caja-mark-collected.flow.spec. */

test.describe("Flujo: Caja v2 (/caja/proyeccion)", () => {
  test("respuesta de dueño + saldo hoy + curva + flujos por período", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/caja/proyeccion");

    await expect(page.getByRole("heading", { level: 1, name: "Caja proyectada" })).toBeVisible();

    // Hero "respuesta de dueño": saldo de hoy (cash_today del fixture = $9.800.000). El monto
    // aparece en el hero y en la tabla → scopeamos con .first() (strict mode si no).
    await expect(page.getByText("La empresa tiene en caja")).toBeVisible();
    await expect(page.getByText("$9.800.000").first()).toBeVisible();

    // Caja v3 (ON en prod): el "Saldo proyectado" es el MEDIDOR de días de caja (no la curva clásica).
    // El fixture proyecta un piso bajo la mínima → "Caja ajustada". ("Total en caja hoy" se oculta con
    // v3: el saldo ya vive en el hero, no se repite.)
    await expect(page.getByText(/Caja (holgada|ajustada|en riesgo)/)).toBeVisible();
    // La tabla de entradas/salidas por período (con la columna "Saldo al cierre" derivada) sigue debajo.
    await expect(page.getByText("Entradas y salidas · por período")).toBeVisible();
    await expect(page.getByText("Saldo al cierre")).toBeVisible();
  });

  test("la landing /caja encabeza con el Resumen v2 + herramientas debajo", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/caja");

    await expect(page.getByRole("heading", { level: 1, name: "Caja" })).toBeVisible();
    // v2 arriba: respuesta de dueño + medidor de caja (contesta el "¿me alcanza?" del título).
    await expect(page.getByText("La empresa tiene en caja")).toBeVisible();
    await expect(page.getByText(/Caja (holgada|ajustada|en riesgo)/)).toBeVisible();
    // Herramientas debajo (Movimientos bancarios).
    await expect(page.getByText("Por clasificar")).toBeVisible();
    // La card "Reporte de caja" es redundante con el v2 arriba → se omite.
    await expect(page.getByText("Reporte de caja")).toHaveCount(0);
  });
});
