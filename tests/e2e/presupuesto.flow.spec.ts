import { test, expect } from "@playwright/test";
import { loginAs, BASE_URL } from "./helpers";

/* Flujo — Presupuesto propositivo (ADR-0091, `presupuesto` ON). "El presupuesto se PROPONE desde tu
   historial; tú lo ajustas." Contra MSW (budget-vs-actual con has_budget:true): el hero "¿cómo vas?"
   muestra el resultado real vs plan + el semáforo, los chips de ajuste "+% ventas", y "Lo que se
   desvía" con el desglose por concepto (ventas/costos/gastos). */

test.describe("Flujo: Presupuesto (/presupuesto)", () => {
  test("hero '¿cómo vas?' con semáforo + ajuste +% ventas", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/presupuesto");

    await expect(page.getByRole("heading", { level: 1, name: "Presupuesto" })).toBeVisible();

    // Hero: la pregunta del dueño + el semáforo (result −47% vs plan del fixture).
    await expect(page.getByText(/¿Cómo vas en/i)).toBeVisible();
    await expect(page.getByText(/vs plan/i)).toBeVisible();

    // Franja de origen + chips de ajuste propositivo.
    await expect(page.getByText(/Lo armó Qavante desde tu/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /\+8% ventas/i })).toBeVisible();

    // "Lo que se desvía": desglose por concepto (fixture: costos/gastos en contra, ventas a favor).
    await expect(page.getByText("Lo que se desvía")).toBeVisible();
    await expect(page.getByText("Costo directo")).toBeVisible();
    await expect(page.getByText(/Gastaste/).first()).toBeVisible();
    await expect(page.getByText(/en contra/).first()).toBeVisible();
    await expect(page.getByText(/a favor/).first()).toBeVisible();
    await expect(page.getByText(/desglose por cuenta/i)).toBeVisible();

    // Toggle Mes / Año.
    await expect(page.getByRole("tab", { name: "Año" })).toBeVisible();
  });

  test("sin presupuesto → estado honesto + 'Proponer' lo genera desde el historial", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    // Cookie sentinel: budget-vs-actual responde has_budget:false hasta que 'propose' la borre.
    await context.addCookies([{ name: "qa_presupuesto", value: "empty", url: BASE_URL }]);
    await page.goto("/presupuesto");

    // Estado honesto: no inventamos plan; invitamos a proponerlo (en español chileno, sin voseo).
    await expect(page.getByText(/Todavía no tienes presupuesto 20\d{2}/)).toBeVisible();
    const proponer = page.getByRole("button", { name: /Proponer presupuesto/i });
    await expect(proponer).toBeVisible();

    // Al proponer, el backend lo arma desde el historial → refetch → hero poblado.
    await proponer.click();
    await expect(page.getByText(/¿Cómo vas en/i)).toBeVisible();
    await expect(page.getByText("Lo que se desvía")).toBeVisible();
  });

  test("Año → grilla editable: ajusto una celda y acepto el presupuesto", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/presupuesto");
    await page.getByRole("tab", { name: "Año" }).click();

    // Grilla anual editable: cuentas × 12 meses + estado borrador.
    await expect(page.getByText(/Tu presupuesto 20\d{2}, mes a mes/)).toBeVisible();
    await expect(page.getByText("Ventas")).toBeVisible();
    await expect(page.getByText("Sueldos")).toBeVisible();
    await expect(page.getByText("Borrador")).toBeVisible();

    // Editar la primera celda de Ventas (10.000.000 → 15.000.000): clic → input → Enter.
    const filaVentas = page.getByRole("row").filter({ hasText: "Ventas" });
    await filaVentas.getByRole("button").first().click();
    const input = page.getByLabel("Monto presupuestado");
    await input.fill("15000000");
    await input.press("Enter");
    await expect(page.getByText("15.000.000").first()).toBeVisible();

    // Aceptar → pasa a Aceptado.
    await page.getByRole("button", { name: /Aceptar presupuesto/i }).click();
    await expect(page.getByText("Aceptado")).toBeVisible();
  });
});
