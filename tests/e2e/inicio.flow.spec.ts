import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Inicio Ejecutivo (/inicio, Sprint C8). El dashboard se cablea a
   `/api/dashboard/summary` (flag `dashboardSummary` ON en el env de e2e) contra MSW.
   Valida que rendericen los bloques clave (saldo de hoy + brecha de caja) y —regla UX
   transversal "todo clickeable a detalle"— que el banner de brecha lleve a la proyección.

   El fixture MSW trae obligaciones críticas ($6,6M) > caja proyectada ($5,4M) → el banner
   de brecha muestra el FALTANTE honesto ($1,2M). Cubre la rama `shortfall` de
   `describeCashGap14d` (fix del framing de la brecha, #609/#612) end-to-end. */

test.describe("Flujo: Inicio Ejecutivo (/inicio)", () => {
  test("muestra saldo + brecha y el banner lleva al detalle de proyección", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/inicio");

    // Saldo de hoy (bloque de caja del hero).
    await expect(page.getByText("$9.800.000").first()).toBeVisible();

    // Banner de brecha: críticas > caja → "Te faltan $1.200.000 … pagos críticos".
    const banner = page.getByRole("link").filter({ hasText: "Te faltan" }).first();
    await expect(banner).toContainText("$1.200.000");
    await expect(banner).toContainText("pagos críticos");

    // Card "Brecha de caja" presente.
    await expect(page.getByText("Brecha de caja")).toBeVisible();

    // Clickeable a detalle: el banner de brecha navega a la proyección de caja.
    await banner.click();
    await expect(page).toHaveURL(/\/caja\/proyeccion/);
  });
});
