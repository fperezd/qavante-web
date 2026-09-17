import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Caja. `/caja/proyeccion` conserva el reporte v2+v3 (hero, saldo hoy y la tabla por
   período); `/caja` sirve la pantalla V02 que producción tiene encendida. En las dos, la
   proyección la publica el run inmutable del backend: el medidor derivado en el frontend se
   retiró con D03. El flujo de conciliar fila-por-fila vive en caja-mark-collected.flow.spec. */

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
    await expect(page.getByRole("heading", { name: "Proyección canónica" })).toBeVisible();
    // La tabla de entradas/salidas por período (con la columna "Saldo al cierre" derivada) sigue debajo.
    await expect(page.getByText("Entradas y salidas · por período")).toBeVisible();
    await expect(page.getByText("Saldo al cierre")).toBeVisible();
  });

  test("la landing /caja sirve V02 con la proyección canónica y la auditoría debajo", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/caja");

    await expect(page.getByRole("heading", { level: 1, name: "Caja" })).toBeVisible();
    /* Producción sirve V02 (`cajaV02` ON en `wrangler.toml`): una pantalla, una pregunta. Arriba
       la lectura de hoy; la proyección es el run inmutable del backend (D03), que separa saldo
       final, mínimo del horizonte y brecha contra cero sin restar obligaciones dos veces (D01). */
    await expect(page.getByRole("region", { name: "Hoy, entra y sale" })).toBeVisible();
    await expect(page.getByText("Saldo en tus cuentas · el mismo número que en Hoy")).toBeVisible();
    await expect(page.getByText("$9.800.000").first()).toBeVisible();
    await expect(page.getByText("Proyección canónica")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Saldo final")).toBeVisible();
    await expect(page.getByText(/Mínimo · \d{4}-\d{2}-\d{2}/)).toBeVisible();
    await expect(page.getByText("Brecha contra cero")).toBeVisible();
    /* El medidor de días derivado en el frontend ya no existe (D03): sus etiquetas
       "Caja holgada/ajustada/en riesgo" no vuelven. El gemelo positivo NO usa la misma regex
       (esas etiquetas no se publican en ninguna parte): ancla, con otra regex, el panel canónico
       que ocupa el lugar del medidor, para que el negativo no pase por bueno en una página vacía. */
    await expect(page.getByText(/Caja (holgada|ajustada|en riesgo)/)).toHaveCount(0);
    await expect(
      page.getByText(/Caja para decidir pagos|Proyección canónica/).first(),
    ).toBeVisible();
    // La auditoría de movimientos queda después de la respuesta financiera, no como requisito.
    await expect(page.getByRole("heading", { name: "Movimientos" })).toBeVisible();
    await expect(page.getByText("Movimientos pendientes")).toBeVisible();
  });
});
