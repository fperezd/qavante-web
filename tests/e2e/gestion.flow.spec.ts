import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Resultado Operacional de Gestión (rediseño 2026-07-14; la vista v2 es la única desde que
   se retiró la clásica). Un mes → respuesta de dueño + cascada + drivers; el rango → hero de período
   + margen en el tiempo + matriz. Contra MSW (operational-result + breakdown + dashboard). */

test.describe("Flujo: Resultado Operacional v2 (/gestion)", () => {
  test("un mes muestra la respuesta de dueño + cascada; el rango muestra la matriz", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/gestion");

    await expect(page.getByRole("heading", { level: 1, name: "Gestión" })).toBeVisible();

    // Badge obligatorio (Maestro §7.5): no es contabilidad oficial.
    await expect(page.getByText(/no es contabilidad oficial/i)).toBeVisible();

    // Un mes por defecto: vista v2 — respuesta de dueño (result del fixture = $3.900.000) + cascada.
    await expect(page.getByText("El negocio ganó este mes")).toBeVisible();
    // El resultado ($3.900.000) aparece en el hero Y en la cascada — coinciden (footing correcto).
    await expect.poll(() => page.getByText("$3.900.000").count()).toBeGreaterThanOrEqual(2);
    await expect(page.getByText("Ingresos")).toBeVisible();
    await expect(page.getByText("$18.500.000")).toBeVisible(); // Ingresos, único
    await expect(page.getByText("Qué explica el resultado")).toBeVisible();
    await expect(page.getByText("Más ventas que el mes anterior.")).toBeVisible(); // driver (texto único)

    // Selector de rango (pedido de Fernando): elegir "Tres meses" → vista de rango.
    await page
      .locator('button[aria-haspopup="dialog"]')
      .filter({ hasText: /20\d{2}/ })
      .click();
    const dialog = page.getByRole("dialog", { name: "Elegir rango de períodos" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Tres meses" }).click();

    // Vista de rango v2: respuesta de dueño del período + margen en el tiempo (protagonista)…
    await expect(page.getByText("El negocio ganó en el período")).toBeVisible();
    await expect(page.getByText("Márgenes del período")).toBeVisible();
    await expect(page.getByText("Margen operacional en el tiempo")).toBeVisible();
    // …y la matriz P&L mes a mes (Chipax) debajo — filas jerárquicas + "(proforma)".
    await expect(page.getByText("Total Ingresos")).toBeVisible();
    // exact: la fila de la matriz "Margen Bruto" ≠ el bloque v2 "Margen bruto".
    await expect(page.getByText("Margen Bruto", { exact: true })).toBeVisible();
    await expect(page.getByText("(proforma)")).toBeVisible();
    await expect(page.getByText("Proyectos")).toBeVisible(); // fila hija, expandida por default

    // Drill-down por documento (CC-API #786): clic en una celda de costo de una cuenta hoja
    // ("Sueldos") → despliega sus facturas debajo. Las celdas de monto son botones clickeables.
    const filaSueldos = page.getByRole("row").filter({ hasText: "Sueldos" });
    await filaSueldos.getByRole("button").first().click();
    await expect(page.getByText(/SOCIEDAD DE PROFESIONALES/i)).toBeVisible();
  });

  test("en el detalle de 'sin clasificar' cada factura trae su cuenta sugerida + botón clasificar", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/gestion");
    await expect(page.getByRole("heading", { level: 1, name: "Gestión" })).toBeVisible();

    // A la vista de rango (la matriz P&L solo aparece ahí).
    await page
      .locator('button[aria-haspopup="dialog"]')
      .filter({ hasText: /20\d{2}/ })
      .click();
    const dialog = page.getByRole("dialog", { name: "Elegir rango de períodos" });
    await dialog.getByRole("button", { name: "Tres meses" }).click();

    // Clic en la hoja "Compras sin clasificar" → despliega sus facturas.
    const filaSinClasif = page.getByRole("row").filter({ hasText: "Compras sin clasificar" });
    await filaSinClasif.getByRole("button").first().click();
    await expect(page.getByText(/PROVEEDOR DEMO SPA/i)).toBeVisible();

    // El doc con propuesta trae la cuenta sugerida PRECARGADA en el selector (editable a mano).
    await expect(page.getByRole("combobox", { name: /PROVEEDOR DEMO SPA/ })).toHaveValue(
      "costos.sueldos",
    );
    await expect(
      page.getByRole("button", { name: "Clasificar", exact: true }).first(),
    ).toBeVisible();

    // Con ≥2 cuentas ya elegidas (sugeridas) aparece el botón para clasificarlas TODAS de una.
    await expect(page.getByRole("button", { name: /Clasificar todo \(2\)/ })).toBeVisible();

    // El doc SIN sugerencia habilita "Sugerir clasificación" (corre el clasificador IA del período).
    await expect(page.getByRole("button", { name: "Sugerir clasificación" })).toBeVisible();

    // Se puede cambiar la cuenta A MANO y clasificar: sin sugerencia igual se elige y no rompe.
    const selDemo = page.getByRole("combobox", { name: /PROVEEDOR DEMO SPA/ });
    await selDemo.selectOption("costos.sueldos");
    await page.getByRole("button", { name: "Clasificar", exact: true }).first().click();
    await expect(page.getByText("No pudimos clasificar. Vuelve a intentar.")).toHaveCount(0);
  });

  test("el mes EN CURSO no dice 'perdió' — muestra 'va en curso, aún sin cerrar'", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/gestion");
    await expect(page.getByRole("heading", { level: 1, name: "Gestión" })).toBeVisible();

    // Abre por defecto en el último mes CERRADO (no el actual) → hay un resultado real, no "perdió".
    await expect(page.getByText("El negocio perdió este mes")).toHaveCount(0);

    // Al elegir el MES ACTUAL (en curso) → reframe honesto, sin veredicto ganó/perdió.
    const hoy = new Date();
    const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
    await page
      .locator('button[aria-haspopup="dialog"]')
      .filter({ hasText: /20\d{2}/ })
      .click();
    const dialog = page.getByRole("dialog", { name: "Elegir rango de períodos" });
    await dialog.getByLabel("Fecha inicial").fill(mesActual);
    await dialog.getByLabel("Fecha final").fill(mesActual);
    await dialog.getByRole("button", { name: "Aplicar" }).click();

    await expect(page.getByText(/va en curso — aún sin cerrar/i)).toBeVisible();
    await expect(page.getByText("El negocio perdió este mes")).toHaveCount(0);
  });
});
