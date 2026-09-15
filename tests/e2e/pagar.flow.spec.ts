import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo — Pagar. Producción publica V05 antes de V2 (`pagarV05="true"` en `wrangler.toml`, y el
   mismo flag en el entorno E2E). La pantalla publica los KPI del contrato D02 —vencido y tramos
   salen de los agregados del SERVIDOR sobre todo el registro, no de la tabla visible—, los chips
   con los conteos de `filter_metadata`, la paginación por cursor, la lectura de caja del run
   canónico y los límites explícitos de acción humana. No se valida una variante V2 que estos
   mismos flags no montan. */

test.describe("Flujo: Pagar V05 de producción (/pagar)", () => {
  test("KPI del servidor + chips de filter_metadata + paginación única", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar");

    await expect(page.getByRole("heading", { level: 1, name: "Pagar" })).toBeVisible();
    await expect(page.getByText("¿A quién le pago, y qué es crítico?")).toBeVisible();

    const resumen = page.getByRole("region", { name: "Vencido, por pagar y caja proyectada" });
    await expect(resumen).toBeVisible();
    /* D02 — "Vencido" es `overdue_summary`, no la suma de las filas. El mock publica el corte al
       2026-06-02, antes del primer vencimiento: cero vencido, dicho como cero conocido. */
    await expect(resumen).toContainText("Vencido");
    await expect(page.getByText("ningún pago vencido conocido")).toBeVisible();
    // "Por pagar · 14 días" es `due_14d` del contrato (arriendo 05-jun + F29 12-jun).
    await expect(resumen).toContainText("Por pagar");
    await expect(resumen).toContainText("14 días");
    await expect(resumen).toContainText("$3.700.000");
    await expect(page.getByText("incluye lo vencido")).toBeVisible();
    await expect(page.getByRole("radio", { name: "14 días" })).toBeChecked();

    /* Los conteos de los chips los publica `filter_metadata` sobre TODO el registro: filtrar o
       paginar no los mueve. */
    await expect(page.getByRole("radio", { name: "Todos · 5" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Vencidos · 0" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Impuestos · 1" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Remuneraciones · 1" })).toBeVisible();

    const pagos = page.getByRole("region", { name: "Pagos y obligaciones" });
    await expect(pagos).toBeVisible();
    await expect(pagos.getByText("Remuneraciones: Junio 2026").first()).toBeVisible();

    // Paginación única, del servidor: una página y sus controles.
    await expect(page.getByText(/Página 1/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Siguiente" })).toBeVisible();

    /* El hero de V2 no se monta con estos flags. Gemelo positivo con la MISMA pantalla: el
       encabezado que V05 sí publica. */
    await expect(page.getByText("La empresa debe pagar")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Exportar esta página" })).toBeVisible();

    // El total del footer es el del contrato, no la suma de la página.
    await expect(page.getByText(/Total por pagar/)).toBeVisible();
    await expect(page.getByText("$9.430.000")).toBeVisible();
  });

  test("la lectura de caja de Pagar es el run canónico H=14, sin restar obligaciones", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar");

    /* El panel aparece cuando el servidor crea la foto H=14; el primer ancla espera ese
       round-trip. */
    await expect(page.getByRole("heading", { name: "Caja para decidir pagos" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/14 días · CLP/)).toBeVisible();
    await expect(page.getByText("Saldo final")).toBeVisible();
    /* La anti-fórmula legacy (obligaciones − caja) no vuelve a esta pantalla. La frase existe en
       el producto —el banner de brecha de Inicio Ejecutivo la renderiza—, así que este negativo
       puede fallar de verdad; no es una regex que no case con nada. */
    await expect(page.getByText(/Te faltan \$/)).toHaveCount(0);
    // Gemelo positivo: la brecha se publica como un hecho propio del run, con su etiqueta.
    await expect(page.getByText("Brecha contra cero")).toBeVisible();
  });

  test("declara que no ejecuta pagos masivos ni posterga automáticamente", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar");

    await expect(page.getByText("No existe un botón “pagar todo”")).toBeVisible();
    await expect(
      page.getByText("Impuestos y sueldos jamás entran en postergaciones automáticas."),
    ).toBeVisible();
    await expect(page.getByText("No se posterga").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /pagar todo/i })).toHaveCount(0);
  });

  test("drill-down: el pago de sueldos lleva al detalle por empleado del período", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar");

    /* El ítem de nómina (`source_external_id` payroll-202606) abre su detalle y desde ahí
       enlaza al período en Remuneraciones. */
    const fila = page.getByRole("row", { name: /Remuneraciones: Junio 2026/ });
    await expect(fila).toBeVisible();
    await fila.getByText("detalle ▾").click();
    const link = fila.getByRole("link", { name: "Ver en Remuneraciones" });
    await expect(link).toHaveAttribute("href", "/remuneraciones?period=2026-06");
    await link.click();
    await expect(page).toHaveURL(/\/remuneraciones\?period=2026-06/, { timeout: 20_000 });
  });
});
