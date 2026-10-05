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
      page.getByRole("heading", { level: 1, name: "Impuestos Mensuales" }),
    ).toBeVisible();

    // La grilla (region con la tabla de estado).
    const grid = page.getByRole("region", { name: "Estado del F29 por período" });
    await expect(grid).toBeVisible();
    // Fila de un mes.
    await expect(grid.getByRole("rowheader", { name: "Enero" })).toBeVisible();

    /* Clic en un mes declarado → abre el detalle. El accessible name puede incluir el total a pagar
       ("Declarado · Total a pagar $X — ver detalle"), así que matcheamos de forma tolerante.

       Marzo en particular: el MSW le da un giro PENDIENTE, así que es el mes que sí tiene una
       decisión de pago hacia adelante. Es el gemelo positivo de la afirmación negativa del test
       siguiente — sin él, borrar las dos opciones de la pantalla dejaría la suite verde. */
    await grid
      .getByRole("row")
      .filter({ hasText: "Marzo" })
      .getByRole("button", { name: /Declarado.*, ver detalle/ })
      .first()
      .click();

    const detail = page.getByRole("region", { name: /Detalle F29 de/ });
    await expect(detail).toBeVisible();
    await expect(detail.getByText("Pagar todo")).toBeVisible();
    await expect(detail.getByText("Postergar el IVA")).toBeVisible();
    // Drill-down al PDF del F29 en el SII (botón: baja por fetch+blob con feedback de carga).
    await expect(detail.getByRole("button", { name: /Ver F29 \(PDF\)/ })).toBeVisible();
  });

  /* #202: el detalle ya calculaba que un período estaba pagado y usaba ese hecho SÓLO para pintar un
     badge verde, mientras debajo seguía ofreciendo "Pagar todo" y "Postergar el IVA" sobre un F29 que
     no debe nada. Enero llega como `sin_giro` con el período declarado, que el contrato define
     literalmente como pagado. */
  test("un período ya pagado muestra su historia y NO ofrece volver a pagarlo", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar/impuestos/f29");

    const grid = page.getByRole("region", { name: "Estado del F29 por período" });
    await expect(grid).toBeVisible();

    await grid
      .getByRole("row")
      .filter({ hasText: "Enero" })
      .getByRole("button", { name: /Declarado.*, ver detalle/ })
      .first()
      .click();

    const detail = page.getByRole("region", { name: /Detalle F29 de/ });
    await expect(detail).toBeVisible();
    // Dice que está pagado, con el total que declaró el F29.
    await expect(detail.getByText("Este período ya está pagado")).toBeVisible();
    // Y no ofrece ninguna de las dos decisiones de pago.
    await expect(detail.getByText("Pagar todo")).toHaveCount(0);
    await expect(detail.getByText("Postergar el IVA")).toHaveCount(0);
    // El desglose y el PDF siguen ahí: se retira la orden de pago, no la información.
    await expect(detail.getByText("Desglose")).toBeVisible();
    await expect(detail.getByRole("button", { name: /Ver F29 \(PDF\)/ })).toBeVisible();
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
