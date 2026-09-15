import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Caja reordenable (`cajaDashboard`). En producción `cajaV02` está ON y `cajaDashboard`
   en "false" (`wrangler.toml`), y la página resuelve V02 ANTES del tablero: el dueño ve la
   pantalla V02, no los bloques movibles. Este flujo fija esa precedencia —que es lo que el
   usuario recibe— en vez de validar una variante que producción no sirve. */

test.describe("Flujo: Caja reordenable (/caja, cajaDashboard)", () => {
  test("con V02 encendida, la landing sirve V02 y el tablero movible no la reemplaza", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/caja");

    await expect(page.getByRole("heading", { level: 1, name: "Caja" })).toBeVisible();
    // La pregunta y la lectura de V02 (no el hero del resumen v2 clásico).
    await expect(page.getByText("¿Me alcanza la caja?")).toBeVisible();
    await expect(page.getByText("Saldo en tus cuentas · el mismo número que en Hoy")).toBeVisible();
    // La auditoría de movimientos queda disponible, pero secundaria.
    await expect(page.getByText("Calidad y auditoría de movimientos")).toBeVisible();
    await expect(page.getByText("Movimientos pendientes")).toBeVisible();

    const main = page.locator("#main-content");
    /* Los controles del tablero NO están: V02 gana la precedencia. Gemelo positivo con la MISMA
       query de rol: los botones de la pantalla V02 sí existen. */
    await expect(main.getByRole("button", { name: /para reordenar/ })).toHaveCount(0);
    await expect(main.getByRole("button", { name: /^Ocultar /i })).toHaveCount(0);
    await expect(main.getByRole("button", { name: "Crear nueva foto" }).first()).toBeVisible();
  });
});
