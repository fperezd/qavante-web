import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo de usuario REAL — cola de conciliación (/caja/conciliacion).

   El motor deja en cola los matches de confianza media (60-90). La pantalla los muestra enfrentando
   el movimiento del banco con el documento sugerido; el dueño confirma o descarta, o "Conciliar
   todas". MSW sirve /api/treasury/reconciliation/review + las mutaciones (deterministas). */

test.describe("Flujo: cola de conciliación (/caja/conciliacion)", () => {
  test("muestra la cola con el match sugerido y su certeza", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/caja/conciliacion");

    await expect(page.getByRole("heading", { level: 1, name: "Conciliación" })).toBeVisible();
    await expect(page.getByText("Hay 3 movimientos")).toBeVisible();

    // La fila de mayor certeza (86%) aparece primero, con su contraparte y el score.
    await expect(page.getByText("Comercial Los Andes SpA")).toBeVisible();
    await expect(page.getByText("86% de certeza")).toBeVisible();
    // Un cobro entra en verde con monto positivo.
    await expect(page.getByText("$1.250.000", { exact: true })).toBeVisible();
  });

  test("confirmar un match dispara la conciliación y confirma con toast", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/caja/conciliacion");

    await page
      .getByRole("button", { name: /Confirmar: .*Comercial Los Andes/i })
      .click();

    await expect(page.getByText("Conciliado.", { exact: true })).toBeVisible();
  });

  test("'Conciliar todas' concilia el lote completo", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/caja/conciliacion");

    await page.getByRole("button", { name: /Conciliar todas \(3\)/i }).click();

    await expect(page.getByText("Conciliamos 3.")).toBeVisible();
  });
});
