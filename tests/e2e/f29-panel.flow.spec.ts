import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo de usuario REAL — panel F29 (/pagar/impuestos/f29). Grilla meses × años
   estilo SII; al clickear un mes declarado abre el detalle con los dos montos
   (pagar todo / postergar IVA). Flag `siiQueries` ON vía playwright.config.
   MSW sirve el estado por año + el detalle del mes. */

test.describe("Flujo: panel F29 (/pagar/impuestos/f29)", () => {
  test("muestra la grilla por período y abre el detalle con/sin IVA de un mes", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar/impuestos/f29");

    await expect(
      page.getByRole("heading", { level: 1, name: "Impuestos Mensuales" }),
    ).toBeVisible();

    // La grilla (region con la tabla de estado).
    const grid = page.getByRole("region", { name: "Estado del F29 por período" });
    await expect(grid).toBeVisible();
    // Fila de un mes.
    await expect(grid.getByRole("rowheader", { name: "Enero" })).toBeVisible();

    /* Clic en un mes declarado → abre el detalle. El accessible name puede incluir el total a pagar
       ("Declarado · Total a pagar $X — ver detalle"), así que matcheamos de forma tolerante.

       Marzo en particular: el MSW le da un giro PENDIENTE, así que es el mes que sí tiene una
       decisión de pago hacia adelante. Es el gemelo positivo de la afirmación negativa del test
       siguiente — sin él, borrar las dos opciones de la pantalla dejaría la suite verde. */
    await grid
      .getByRole("row")
      .filter({ hasText: "Marzo" })
      .getByRole("button", { name: /Declarado.*, ver detalle/ })
      .first()
      .click();

    const detail = page.getByRole("region", { name: /Detalle F29 de/ });
    await expect(detail).toBeVisible();
    await expect(detail.getByText("Pagar todo")).toBeVisible();
    await expect(detail.getByText("Postergar el IVA")).toBeVisible();
    // Drill-down al PDF del F29 en el SII (botón: baja por fetch+blob con feedback de carga).
    await expect(detail.getByRole("button", { name: /Ver F29 \(PDF\)/ })).toBeVisible();
  });

  /* #202: el detalle ya calculaba que un período estaba pagado y usaba ese hecho SÓLO para pintar un
     badge verde, mientras debajo seguía ofreciendo "Pagar todo" y "Postergar el IVA" sobre un F29 que
     no debe nada. Enero llega como `sin_giro` con el período declarado, que el contrato define
     literalmente como pagado. */
  test("un período ya pagado muestra su historia y NO ofrece volver a pagarlo", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar/impuestos/f29");

    const grid = page.getByRole("region", { name: "Estado del F29 por período" });
    await expect(grid).toBeVisible();

    await grid
      .getByRole("row")
      .filter({ hasText: "Enero" })
      .getByRole("button", { name: /Declarado.*, ver detalle/ })
      .first()
      .click();

    const detail = page.getByRole("region", { name: /Detalle F29 de/ });
    await expect(detail).toBeVisible();
    // Dice que está pagado, con el total que declaró el F29.
    await expect(detail.getByText("Este período ya está pagado")).toBeVisible();
    // Y no ofrece ninguna de las dos decisiones de pago.
    await expect(detail.getByText("Pagar todo")).toHaveCount(0);
    await expect(detail.getByText("Postergar el IVA")).toHaveCount(0);
    // El desglose y el PDF siguen ahí: se retira la orden de pago, no la información.
    await expect(detail.getByText("Desglose")).toBeVisible();
    await expect(detail.getByRole("button", { name: /Ver F29 \(PDF\)/ })).toBeVisible();
  });

  test("botón Actualizar F29 dispara el sync y confirma con toast", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar/impuestos/f29");

    const actualizar = page.getByRole("button", { name: /Actualizar F29/ });
    await expect(actualizar).toBeVisible();
    await actualizar.click();

    // Toast honesto: el MSW devuelve persistidos_nuevos>0 → reporta cuántos bajó.
    await expect(page.getByText(/Bajamos \d+ F29 nuevos del SII/)).toBeVisible();
  });

  /* ── El puente con lo que cobra el SII (D13, #202) ────────────────────────────────────────────
     El bloque "Desglose" pinta seis filas al lado del total y nunca las reconcilia: si los códigos
     observados suman distinto del total oficial (código 91), la diferencia existe igual y nadie la
     ve. Lo que sigue recorre la pantalla viva y mide que la diferencia esté rotulada, que las tres
     lecturas de la evidencia bancaria se lean distinto, y que un período sin bridge no muestre
     panel — cada afirmación con el período que prueba lo contrario. */

  /** Abre el detalle del primer año declarado de un mes. Las columnas van de más nuevo a más viejo,
   *  así que para un mes sin período en 2026 el primero declarado es el de 2025. */
  async function abrirDetalleDelMes(page: import("@playwright/test").Page, mes: string) {
    const grid = page.getByRole("region", { name: "Estado del F29 por período" });
    await expect(grid).toBeVisible();
    await grid
      .getByRole("row")
      .filter({ hasText: mes })
      .getByRole("button", { name: /Declarado.*, ver detalle/ })
      .first()
      .click();
    const detail = page.getByRole("region", { name: /Detalle F29 de/ });
    await expect(detail).toBeVisible();
    return detail;
  }

  test("el detalle rotula la diferencia no explicada del período, con su monto y su dirección", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar/impuestos/f29");

    /* Enero 2026: los códigos del F29 suman 7.265.529 contra un total oficial de 7.450.761. El
       contrato publica la resta como `unexplained_delta` = −185.232. */
    const detail = await abrirDetalleDelMes(page, "Enero");

    await expect(detail.getByText("Diferencia no explicada")).toBeVisible();
    await expect(detail.getByText("$185.232", { exact: true })).toBeVisible();
    // El signo no se deja interpretar sobre una cifra tributaria: la dirección va en palabras.
    await expect(
      detail.getByText(/suman \$185\.232 MENOS que el total que cobra el SII/),
    ).toBeVisible();
    // Las dos cifras que producen la diferencia quedan al lado, para poder ir a buscarla.
    await expect(detail.getByText("Cobra el SII (código 91)")).toBeVisible();
    await expect(detail.getByText("Suman los códigos del F29")).toBeVisible();

    /* El período tiene DOS declaraciones: la del folio que la tarjeta muestra y una rectificatoria
       posterior con total 6.000.000 y sin diferencia. Las cifras del panel son las del folio que
       está al frente, no las de la otra declaración. */
    await expect(detail.getByText("$6.000.000")).toHaveCount(0);
  });

  /* EL GEMELO del test anterior: un período SIN bridge no muestra el panel, y el Desglose sigue
     donde estaba. Sin este caso, borrar el panel entero dejaría la suite verde. */
  test("un período sin puente publicado no muestra el panel, y el Desglose sigue ahí", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar/impuestos/f29");

    // Octubre: sin período en 2026, declarado en 2025, y el MSW le devuelve `bridges: []`.
    const detail = await abrirDetalleDelMes(page, "Octubre");

    await expect(detail.getByTestId("f29-bridge")).toHaveCount(0);
    await expect(detail.getByText("Diferencia no explicada")).toHaveCount(0);
    await expect(detail.getByText("Desglose")).toBeVisible();
    await expect(detail.getByRole("button", { name: /Ver F29 \(PDF\)/ })).toBeVisible();
  });

  test("un F29 pagado en cuotas muestra cada cuota con lo que cubrió", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar/impuestos/f29");

    /* Noviembre 2025: `partial`, dos cuotas declaradas (4.000.000 por movimiento bancario y
       1.000.000 por comprobante del SII) y `bank_movement_id` null porque ningún movimiento único
       representa el pago completo. */
    const detail = await abrirDetalleDelMes(page, "Noviembre");

    await expect(detail.getByText(/se pagó en 2 cuotas/)).toBeVisible();
    await expect(detail.getByText("$4.000.000", { exact: true })).toBeVisible();
    await expect(detail.getByText("$1.000.000", { exact: true })).toBeVisible();
    // Los dos hechos se nombran distinto: plata que salió del banco y el SII acusando el pago.
    await expect(detail.getByText("movimiento bancario declarado")).toBeVisible();
    await expect(detail.getByText("comprobante del SII OP-884120")).toBeVisible();
    // Y lo que falta para cubrir el cobro es un número, no un hueco.
    await expect(detail.getByText("$2.450.761", { exact: true })).toBeVisible();

    /* La afirmación que importa: este período NO se lee como uno que nadie pagó. Las dos lecturas
       traen `bank_movement_id` null; colapsarlas borraría la diferencia. */
    await expect(
      detail.getByText(/Nadie declaró todavía un movimiento ni un comprobante/),
    ).toHaveCount(0);
  });

  /* EL GEMELO: la ausencia explícita. Mismo `bank_movement_id` null, significado opuesto. */
  test("un período que nadie pagó lo dice, con el monto que sigue sin respaldo", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar/impuestos/f29");

    // Enero 2026: `applications` vacía, o sea nadie declaró movimiento ni comprobante.
    const detail = await abrirDetalleDelMes(page, "Enero");

    await expect(
      detail.getByText(/Nadie declaró todavía un movimiento ni un comprobante para este período/),
    ).toBeVisible();
    await expect(detail.getByText(/los \$7\.450\.761 de arriba siguen sin respaldo/)).toBeVisible();
    await expect(
      detail.getByText(/falta declarar el movimiento bancario que pagó este F29/),
    ).toBeVisible();
    await expect(detail.getByText(/se pagó en \d+ cuotas/)).toHaveCount(0);
  });

  test("cuando la Consulta de Giros no responde, el período declarado muestra lo que declaró y ofrece re-consultar", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar/impuestos/f29");

    // Noviembre 2025: el MSW devuelve 502 en la Consulta de Giros de ese período.
    const detail = await abrirDetalleDelMes(page, "Noviembre");

    await expect(detail.getByText("Lo que declaró este F29")).toBeVisible();
    await expect(
      detail.getByText(/la Consulta de Giros del SII, que no respondió en este momento/),
    ).toBeVisible();
    await expect(detail.getByRole("button", { name: "Consultar los giros del SII" })).toBeVisible();

    /* Lo que NO puede pasar: que el silencio del SII se convierta en una orden de pago. Antes de
       #202 un período declarado sin respuesta de giros caía en las opciones por omisión. */
    await expect(detail.getByText("Pagar todo")).toHaveCount(0);
    await expect(detail.getByText("Postergar el IVA")).toHaveCount(0);
  });

  /* EL GEMELO: un período cuya Consulta de Giros SÍ responde no ofrece re-consultarla, y afirma el
     pago. Sin este caso, dejar la pantalla siempre en la rama de "no respondió" pasaría igual. */
  test("un período cuya Consulta de Giros respondió no ofrece volver a consultarla", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/pagar/impuestos/f29");

    const detail = await abrirDetalleDelMes(page, "Enero");

    await expect(detail.getByText("Este período ya está pagado")).toBeVisible();
    await expect(detail.getByRole("button", { name: "Consultar los giros del SII" })).toHaveCount(
      0,
    );
    await expect(detail.getByText("Lo que declaró este F29")).toHaveCount(0);
  });
});
