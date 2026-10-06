import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Flujo: Gestión de cobros documental (/cobrar)", () => {
  test.beforeEach(async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/cobrar");
  });

  test("publica KPIs y documentos sin mezclar las monedas", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Gestión de cobros" })).toBeVisible();
    // El Vencido sale de `GET /accounts-receivable` ($7.900.000 · 31,9%) y NO del `overdue` de
    // `/documents` ($4.000.000): el agregado es el único que puede publicar `null` cuando la
    // cartera no tiene fechas, y es el mismo número que "Te deben" en Inicio (Ley 1).
    const resumen = page.getByRole("region", { name: "Resumen de cobranza" });
    await expect(resumen).toContainText("$7.900.000");
    await expect(resumen).toContainText("31,9% de la cartera");
    await expect(page.getByRole("row", { name: /Constructora Andes SpA/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Comercial del Sur Ltda/ })).toBeVisible();
  });

  test("separa documentos sin vencimiento confirmado de la mora", async ({ page }) => {
    await page.getByRole("radio", { name: "Sin vencimiento" }).click();
    await expect(page.getByRole("row", { name: /Comercial del Sur Ltda/ })).toContainText(
      "Sin vencimiento confirmado",
    );
    await expect(page.getByRole("row", { name: /Constructora Andes SpA/ })).toHaveCount(0);
  });

  test("permite auditar cedidas pero no seleccionarlas para cobranza", async ({ page }) => {
    await page.getByRole("button", { name: "Cedidas" }).click();
    const cedida = page.getByRole("row", { name: /Minera Atacama SA/ });
    await expect(cedida).toBeVisible();
    await expect(cedida.getByRole("checkbox")).toBeDisabled();
  });

  test("envía un recordatorio manual sólo para documentos elegibles", async ({ page }) => {
    await page.getByRole("checkbox", { name: "Seleccionar 1234" }).check();
    await page.getByRole("button", { name: "Enviar recordatorio" }).click();
    await expect(page.getByText("1 recordatorio enviado")).toBeVisible();
  });

  test("expone las tres plantillas automáticas y su vista previa", async ({ page }) => {
    await page.goto("/cobrar/recordatorios");
    for (const title of [
      "Recordatorio previo",
      "Recordatorio de vencimiento",
      "Recordatorio de mora",
    ]) {
      await expect(page.getByText(title, { exact: true })).toBeVisible();
    }
    await page.getByRole("button", { name: "Ver correo" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

/* ── #207 en el grano de los documentos: la búsqueda que nunca preguntó ──────────────────────
 *
 * La pantalla pedía `?limit=100` y filtraba en memoria, así que un documento fuera de la página
 * traída era inalcanzable POR CONSTRUCCIÓN: escribir "VOLCAN" contestaba que no aparecía sobre
 * una cartera que sí lo tenía. El fixture tiene 64 documentos y VOLCAN es el último, fuera de
 * la primera página de 50: estos dos tests sólo pasan si el término viaja al servidor.
 *
 * Se teclea en la pantalla de verdad, que es lo que ninguna de las pruebas existentes hacía:
 * `renderToStaticMarkup` no corre efectos, así que el retardo del buscador y el "traer más"
 * estaban probados por funciones puras y por la capa de API, nunca por el teclado. */
test.describe("#207 · el buscador pregunta por toda la cartera, no por lo que está a la vista", () => {
  test.beforeEach(async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/cobrar");
  });

  test("encuentra a VOLCAN aunque esté fuera de la primera página", async ({ page }) => {
    // Premisa del test, no adorno: si VOLCAN ya estuviera a la vista, buscarlo no probaría nada.
    await expect(page.getByRole("row", { name: /VOLCAN/ })).toHaveCount(0);
    await expect(page.getByRole("row", { name: /Constructora Andes SpA/ })).toBeVisible();

    await page.getByRole("searchbox").fill("VOLCAN");

    const fila = page.getByRole("row", { name: /VOLCAN Comercializadora SpA/ });
    await expect(fila).toBeVisible();
    await expect(fila).toContainText("$13.300");
    // Y la cartera que queda a la vista es la de la búsqueda, no la de antes.
    await expect(page.getByRole("row", { name: /Constructora Andes SpA/ })).toHaveCount(0);
  });

  test("el pie dice la cartera del servidor y las filas traídas por separado", async ({ page }) => {
    // 64 en cartera, 50 traídas: los dos números existen y son distintos. El pie viejo los unía
    // con un "de" y hacía leer "50 de 64" como si quedaran 14 a un click, sin ofrecer el click.
    const pie = page.getByRole("status").filter({ hasText: /cartera/ });
    await expect(pie).toContainText("64 documentos en la cartera");
    await expect(pie).toContainText("50 traídas hasta acá");

    // Y ahora el click existe: trae la página siguiente y el recorrido avanza de verdad.
    await page.getByRole("button", { name: /Traer 50 documentos más/ }).click();
    await expect(pie).toContainText("64 traídas hasta acá");
    await expect(page.getByRole("row", { name: /VOLCAN Comercializadora SpA/ })).toBeVisible();
  });

  test("cambiar la búsqueda reinicia el recorrido en vez de encadenar la página anterior", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /Traer 50 documentos más/ }).click();
    await expect(page.getByRole("status").filter({ hasText: /cartera/ })).toContainText(
      "64 traídas hasta acá",
    );

    await page.getByRole("searchbox").fill("Minera");
    const pie = page.getByRole("status").filter({ hasText: /cartera/ });
    await expect(pie).toContainText("1 documento calza con «Minera»");
    await expect(pie).toContainText("1 traída hasta acá");
  });
});
