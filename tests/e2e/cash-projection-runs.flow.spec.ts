import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("WEB-04 · runs inmutables de caja", () => {
  test("Caja separa saldo final, valle y brecha y conserva identidad del escenario", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/caja");

    const panel = page.locator("[data-projection-run]").first();
    /* El panel no existe hasta que el servidor CREA la foto (POST del run): el primer ancla
       espera esa ida y vuelta, no un render local. El margen es de tiempo, no de cobertura. */
    await expect(panel.getByText("Saldo final")).toBeVisible({ timeout: 20_000 });
    await expect(panel.getByText(/Mínimo · 2026-09-12/)).toBeVisible();
    await expect(panel.getByText("Brecha contra cero")).toBeVisible();
    await expect(panel.getByText("$3.000.000", { exact: true })).toBeVisible();
    await expect(panel.getByText("−$1.000.000", { exact: true })).toBeVisible();
    // La brecha aparece en la métrica destacada y otra vez en el puente del escenario: se
    // ancla la métrica por su etiqueta en vez de asumir que el monto es único en el panel.
    await expect(
      panel.getByText("Brecha contra cero").locator("..").getByText("$1.000.000", { exact: true }),
    ).toBeVisible();
    await expect(panel.getByText(/90 días · CLP/)).toBeVisible();
    await expect(panel).toContainText("cash-projection-run-v1");
    await panel.getByText(/Abrir 3 componentes del puente/).click();
    // El contrato `CashProjectionBridgeComponent` publica dirección, clave, fuente, fecha de
    // impacto, monto funcional y evidencia; el front no inventa original, FX ni proveniencia.
    await expect(panel.getByText(/^(Entrada|Salida) · /)).toHaveCount(3);
    await expect(panel.getByText(/^Impacto \d{4}-\d{2}-\d{2} · fuente /)).toHaveCount(3);
    await expect(panel.getByText(/^Evidencia /)).toHaveCount(3);
    /* El monto FUNCIONAL por componente, tal como lo publica el contrato: una entrada de
       $5.000.000 y dos salidas ($11.000.000 y $1.000.000). Antes acá había un negativo con una
       regex que no casa con nada renderizado —pasaba siempre—; el hecho que hay que fijar es
       que el monto de cada componente SE MUESTRA y es el del servidor. */
    const componentes = panel.locator("details li");
    await expect(componentes).toHaveCount(3);
    await expect(componentes.getByText("$5.000.000", { exact: true })).toHaveCount(1);
    await expect(componentes.getByText("$11.000.000", { exact: true })).toHaveCount(1);
    await expect(componentes.getByText("$1.000.000", { exact: true })).toHaveCount(1);
  });

  test("selector no presenta el escenario recurrente parcial como disponible", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/caja");
    await page.getByLabel("Escenario").selectOption("scheduled_with_recurring_income_v1");
    await expect(page.getByText("Cobertura parcial · no usar para decidir")).toBeVisible();
    await expect(page.getByText(/soporte de decisión: no sustenta una decisión/)).toBeVisible();
    // Gemelo: el código crudo del contrato no se publica en pantalla.
    await expect(page.getByText(/soporte de decisión: abstain/)).toHaveCount(0);
    await expect(page.getByText(/recurring_income_not_durable/).first()).toBeVisible();
    await expect(page.getByText(/relevante para caja/).first()).toBeVisible();
    await page.getByText("Ver 1 más").click();
    await expect(page.getByText(/recurrence:unavailable-6/)).toBeVisible();
  });

  test("una cobertura expirada se presenta atrasada según el día de Santiago", async ({
    page,
    context,
  }) => {
    await page.clock.setFixedTime(new Date("2026-09-23T03:00:00Z"));
    await loginAs(context, "owner");
    await page.goto("/caja");
    await expect(
      page.locator("[data-projection-run]").first().getByText("Datos atrasados"),
    ).toBeVisible();
  });

  test("Pagar crea una foto H=14 y no revive la resta de obligaciones", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar");
    await expect(page.getByRole("heading", { name: "Caja para decidir pagos" })).toBeVisible();
    await expect(page.getByText(/14 días · CLP/)).toBeVisible();
    await expect(page.getByText("Brecha contra cero")).toBeVisible();
    /* La anti-fórmula legacy (obligaciones − caja) no vuelve a esta pantalla. La frase existe en
       el producto —el banner de brecha de Inicio Ejecutivo la renderiza—, así que este negativo
       puede fallar de verdad; no es una regex que no case con nada. */
    await expect(page.getByText(/Te faltan \$/)).toHaveCount(0);
    // Gemelo positivo: la brecha se publica como un hecho propio del run, con su etiqueta.
    await expect(page.getByText("Brecha contra cero")).toBeVisible();
  });
});
