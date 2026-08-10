import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Consistencia de datos: los números que DEBEN cuadrar, cuadran — dentro de cada pantalla y sin
   cifras contradictorias entre lugares. Contra MSW con fixtures que FOOTEAN (result = suma de líneas
   de P&L, tanto en Gestión como en Presupuesto).

   Alcance: valida la consistencia del FRONTEND — que no invente ni contradiga (la cascada coincide
   con el hero, la grilla footea, el hero no pelea con los desvíos, el ritmo usa la métrica honesta).
   NO valida el dato de ORIGEN (que el presupuesto propuesto cuadre con los actuals): eso es del motor
   contable y es el criterio de aceptación que quedó para CC-API. */

test.describe("Consistencia de datos (Gestión + Presupuesto)", () => {
  test("Gestión: el resultado del hero coincide con la cascada + el ritmo usa la métrica honesta", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/gestion");
    await expect(page.getByRole("heading", { level: 1, name: "Gestión" })).toBeVisible();

    // El resultado ($3.900.000) sale en el hero Y en la cascada: la MISMA cifra, sin contradicción.
    // (18.500.000 − 7.400.000 − 4.200.000 − 900.000 − 2.100.000 = 3.900.000 → footea.)
    await expect.poll(() => page.getByText("$3.900.000").count()).toBeGreaterThanOrEqual(2);
    await expect(page.getByText("$18.500.000")).toBeVisible(); // Ingresos de la cascada (único)

    // Ritmo coherente: vs mes anterior en MONTO (+$600.000), no en % (que explota en base chica).
    await expect(page.getByText("vs. mes anterior")).toBeVisible();
    await expect(page.getByText("+$600.000")).toBeVisible();
    // vs año anterior SÍ va en % (base estable, señal de tendencia): 7,1% del fixture (signo aparte).
    await expect(page.getByText("vs. mismo mes año anterior")).toBeVisible();
    await expect(page.getByText(/7,1%/)).toBeVisible();
  });

  test("Presupuesto: la grilla anual FOOTEA — Resultado = Ingresos − Costos − Gastos", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/presupuesto");
    await page.getByRole("tab", { name: "Año" }).click();
    await expect(page.getByText(/Tu presupuesto 20\d{2}, mes a mes/)).toBeVisible();

    // Fixture por mes: Ventas +10M (Ingresos), Sueldos −4M (Costos directos), Arriendo −1M (Gastos).
    // Subtotales por sección, y el Resultado que DEBE footear: 10 − 4 − 1 = 5M.
    await expect(
      page.getByRole("row").filter({ hasText: "Ingresos" }).getByText("10.000.000").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("row").filter({ hasText: "Costos directos" }).getByText("4.000.000").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("row").filter({ hasText: "Gastos operacionales" }).getByText("1.000.000").first(),
    ).toBeVisible();
    // El footing: la fila Resultado muestra 5.000.000 (= 10 − 4 − 1). Si el modelo sumara mal, fallaría.
    await expect(
      page.getByRole("row").filter({ hasText: "Resultado" }).getByText("5.000.000").first(),
    ).toBeVisible();
  });

  test("Presupuesto: el hero no se contradice con 'Lo que se desvía' (footea)", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/presupuesto");
    await expect(page.getByRole("heading", { level: 1, name: "Presupuesto" })).toBeVisible();

    // Fixture budget-vs-actual que footea: revenue +4M (a favor), costos −5M/−2M (en contra) →
    // resultado 3M ABAJO del plan. El hero y los desvíos deben contar la misma historia.
    await expect(page.getByText(/vas/)).toBeVisible();
    await expect(page.getByText("$3.000.000")).toBeVisible(); // la variación del resultado (10M plan → 7M real)
    await expect(page.getByText(/abajo/)).toBeVisible();

    // Los desvíos que EXPLICAN ese −3M: ventas +$4.000.000 a favor, costos en contra.
    await expect(page.getByText("Lo que se desvía")).toBeVisible();
    await expect(page.getByText(/\$4\.000\.000/).first()).toBeVisible(); // revenue a favor
    await expect(page.getByText("a favor").first()).toBeVisible();
    await expect(page.getByText("en contra").first()).toBeVisible();
  });
});
