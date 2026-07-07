import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo de usuario REAL — filtrar movimientos clasificados por dirección
   (cobrar/pagar) en /caja/clasificados. El control segmentado de primer nivel
   (Todos / Cobrar / Pagar) filtra client-side; credit = Cobrar, debit = Pagar.

   Flag `bankMovementClassification` ON vía playwright.config (espeja prod).
   La fixture MSW sirve clasificados con ambas direcciones en la cuenta CLP. */

test.describe("Flujo: Clasificados — filtro cobrar/pagar (/caja/clasificados)", () => {
  test("el segmentado Todos/Cobrar/Pagar filtra la tabla por dirección", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/caja/clasificados");

    await expect(
      page.getByRole("heading", { level: 1, name: "Movimientos clasificados" }),
    ).toBeVisible();

    const table = page.locator("table");
    await expect(table).toBeVisible();

    // La columna "Dir." muestra "Ingreso" (credit) / "Egreso" (debit) por fila.
    const ingresos = table.getByText("Ingreso", { exact: true });
    const egresos = table.getByText("Egreso", { exact: true });

    // Estado inicial (Todos): conviven ingresos y egresos.
    await expect(ingresos.first()).toBeVisible();
    await expect(egresos.first()).toBeVisible();

    // Cobrar → solo credit: desaparecen los egresos, quedan ingresos.
    await page.getByRole("radio", { name: "Cobrar" }).click();
    await expect(egresos).toHaveCount(0);
    await expect(ingresos.first()).toBeVisible();

    // Pagar → solo debit: desaparecen los ingresos, quedan egresos.
    await page.getByRole("radio", { name: "Pagar" }).click();
    await expect(ingresos).toHaveCount(0);
    await expect(egresos.first()).toBeVisible();

    // Todos → vuelven ambos.
    await page.getByRole("radio", { name: "Todos" }).click();
    await expect(ingresos.first()).toBeVisible();
    await expect(egresos.first()).toBeVisible();
  });

  test("el segmentado se opera por teclado (flechas mueven la selección)", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/caja/clasificados");

    const todos = page.getByRole("radio", { name: "Todos" });
    const cobrar = page.getByRole("radio", { name: "Cobrar" });
    await expect(todos).toBeVisible();

    // Foco en "Todos" (roving tabindex) → flecha derecha selecciona "Cobrar".
    await todos.focus();
    await page.keyboard.press("ArrowRight");
    await expect(cobrar).toHaveAttribute("aria-checked", "true");
    // Los egresos se filtran (quedó en Cobrar) → la selección por teclado aplicó.
    await expect(page.getByText("Egreso", { exact: true })).toHaveCount(0);

    // Flecha izquierda vuelve a "Todos".
    await page.keyboard.press("ArrowLeft");
    await expect(todos).toHaveAttribute("aria-checked", "true");
  });
});
