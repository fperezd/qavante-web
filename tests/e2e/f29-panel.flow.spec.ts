import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo de usuario REAL — panel F29 (/pagar/impuestos/f29). Grilla meses × años
   estilo SII; al clickear un mes declarado abre el detalle con los dos montos
   (pagar todo / postergar IVA). Flag `siiQueries` ON vía playwright.config.
   MSW sirve el estado por año + el detalle del mes. */

test.describe("Flujo: panel F29 (/pagar/impuestos/f29)", () => {
  test("muestra la grilla por período y abre el detalle con/sin IVA de un mes", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar/impuestos/f29");

    await expect(
      page.getByRole("heading", { level: 1, name: "F29 — Estado por período" }),
    ).toBeVisible();

    // La grilla (region con la tabla de estado).
    const grid = page.getByRole("region", { name: "Estado del F29 por período" });
    await expect(grid).toBeVisible();
    // Fila de un mes.
    await expect(grid.getByRole("rowheader", { name: "Enero" })).toBeVisible();

    // Clic en un mes declarado → abre el detalle.
    await grid
      .getByRole("button", { name: /Declarado — ver detalle/ })
      .first()
      .click();

    const detail = page.getByRole("region", { name: /Detalle F29 de/ });
    await expect(detail).toBeVisible();
    await expect(detail.getByText("Pagar todo")).toBeVisible();
    await expect(detail.getByText("Postergar el IVA")).toBeVisible();
    // Drill-down al PDF del F29 en el SII.
    await expect(detail.getByRole("link", { name: /Ver F29 \(PDF\)/ })).toBeVisible();
  });

  test("botón Actualizar F29 dispara el sync y confirma con toast", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar/impuestos/f29");

    const actualizar = page.getByRole("button", { name: /Actualizar F29/ });
    await expect(actualizar).toBeVisible();
    await actualizar.click();

    // Toast honesto: el MSW devuelve persistidos_nuevos>0 → reporta cuántos bajó.
    await expect(page.getByText(/Bajamos \d+ F29 nuevos del SII/)).toBeVisible();
  });
});
