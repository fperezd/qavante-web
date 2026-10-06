import type { Page } from "@playwright/test";
import {
  test,
  expect,
  esperarApi,
  jsonDeRespuesta,
  type ApiLectura,
  type Evidencia,
} from "./support/fixtures";
import { SESSION, SIN_SESION } from "./support/env";
import { bandejaDeTrabajo, cuentas as leerCuentas, revision, sinClasificar } from "./support/datos";
import { clp, num } from "./support/finanzas";
import {
  calcesExactosEnRevision,
  enDosColas,
  huerfanosYDuplicados,
  listar,
  monedaPorCuenta,
  pagosFraccionadosSinCombinar,
  porDireccion,
  repetidosEntreColas,
  rutContradicho,
} from "./support/invariantes";
import type {
  BankAccount,
  BankMovement,
  BankMovementsList,
  ReviewItem,
  ReviewQueue,
} from "./support/tipos";

/* Bandeja v07 (src/components/bandeja/v07): Conciliar y Clasificar.
   Sólo lectura: se navega con `?tab=…&movimiento=<id>` para poner una tarjeta en pantalla y se lee
   su texto. Nunca se pulsa "Sí, conciliar", "Guardar", "Clasificar" ni "No es esta". */

interface Bandeja {
  review: ReviewItem[];
  clasificar: BankMovement[];
  clasificarTotal: number;
  cuentas: BankAccount[];
}

/** Abre /bandeja y toma las colas de las MISMAS respuestas que pintó la página. */
async function cargarBandeja(
  page: Page,
  api: ApiLectura,
  empresa: string,
  evidencia: Evidencia,
): Promise<Bandeja> {
  const pReview = esperarApi(page, /^\/api\/treasury\/reconciliation\/review/);
  const pClasificar = esperarApi(page, /^\/api\/bank-movements\?.*status=unclassified/);
  await page.goto("/bandeja");
  let review = (await jsonDeRespuesta<ReviewQueue>(await pReview))?.items ?? null;
  /* Sólo se usan `items` y `total`: el fallback por API no puede fabricar el resto de la
     respuesta, y menos `cuentas_retiradas`, que es una medición de producción. */
  let clas: Pick<BankMovementsList, "items" | "total"> | null =
    await jsonDeRespuesta<BankMovementsList>(await pClasificar);
  if (!review) {
    evidencia.nota("La página no pidió la cola de conciliación: se lee por API.");
    review = (await revision(api, empresa)).items;
  }
  if (!clas) {
    evidencia.nota("La página no pidió la cola de clasificación: se lee por API.");
    const s = await sinClasificar(api, empresa);
    clas = { items: s.items, total: s.total };
  }
  return {
    review,
    clasificar: clas.items ?? [],
    clasificarTotal: clas.total ?? clas.items?.length ?? 0,
    cuentas: await leerCuentas(api),
  };
}

const sinEspacios = (s: string) => s.replace(/[\s\u00a0\u202f]/g, "");

test.describe("QA producción · Bandeja", () => {
  test.skip(!SESSION, SIN_SESION);

  test("B03 — no se propone un documento cuyo RUT contradice el RUT de la glosa", async ({
    page,
    api,
    empresa,
    evidencia,
  }) => {
    const b = await cargarBandeja(page, api, empresa, evidencia);
    const malos = rutContradicho(b.review);
    expect(
      malos,
      `${malos.length} propuesta(s) de conciliación contra un documento con otro RUT:\n${listar(malos)}`,
    ).toEqual([]);
  });

  test("B04 — los movimientos en dólares se muestran con US$ y decimales, no con signo de peso", async ({
    page,
    api,
    empresa,
    evidencia,
  }) => {
    const b = await cargarBandeja(page, api, empresa, evidencia);
    const monedas = monedaPorCuenta(b.cuentas);
    const monedaDe = (m: { currency_code?: string | null; bank_account_id?: string }) =>
      (m.currency_code || monedas.get(m.bank_account_id ?? "") || "CLP").toUpperCase();

    const casos: { tab: "clasificar" | "conciliar"; id: string; monto: number; moneda: string }[] =
      [
        ...b.clasificar
          .filter((m) => monedaDe(m) !== "CLP")
          .slice(0, 3)
          .map((m) => ({
            tab: "clasificar" as const,
            id: m.id,
            monto: Math.abs(num(m.amount)),
            moneda: monedaDe(m),
          })),
        ...b.review
          .filter((r) => (r.currency_code || "CLP").toUpperCase() !== "CLP")
          .slice(0, 2)
          .map((r) => ({
            tab: "conciliar" as const,
            id: r.movement_id,
            monto: Math.abs(num(r.amount)),
            moneda: (r.currency_code || "").toUpperCase(),
          })),
      ];
    test.skip(casos.length === 0, "Hoy no hay movimientos en moneda extranjera en la Bandeja.");

    for (const c of casos) {
      await page.goto(`/bandeja?tab=${c.tab}&movimiento=${encodeURIComponent(c.id)}`);
      const carta = page.getByRole("region", {
        name: c.tab === "clasificar" ? "Excepción por clasificar" : "Excepción por conciliar",
      });
      await expect(carta).toBeVisible();
      const texto = sinEspacios((await carta.innerText()) ?? "");
      const esperado = sinEspacios(clp(c.monto, c.moneda));
      expect
        .soft(
          texto,
          `${c.tab} ${c.id}: un movimiento de ${clp(c.monto, c.moneda)} debería verse como "${clp(c.monto, c.moneda)}"`,
        )
        .toContain(esperado);
      expect
        .soft(
          texto,
          `${c.tab} ${c.id}: el monto en ${c.moneda} aparece con signo de peso sin decimales`,
        )
        .not.toContain(sinEspacios(clp(Math.round(c.monto))));
    }
  });

  test("B05 — la Bandeja no trae movimientos de cuentas fuera de las de la empresa ni duplicados entre cuentas", async ({
    page,
    api,
    empresa,
    evidencia,
  }) => {
    const b = await cargarBandeja(page, api, empresa, evidencia);
    const { huerfanos, duplicados } = huerfanosYDuplicados(b.clasificar, b.cuentas);
    expect
      .soft(
        huerfanos,
        `${huerfanos.length} movimiento(s) por clasificar cuelgan de una cuenta que no está activa:\n${listar(huerfanos)}`,
      )
      .toEqual([]);
    expect(
      duplicados,
      `${duplicados.length} operación(es) duplicada(s) en dos cuentas:\n${listar(duplicados)}`,
    ).toEqual([]);
  });

  test("B06 — un movimiento está en una sola cola (no en Conciliar y Clasificar a la vez)", async ({
    page,
    api,
    empresa,
    evidencia,
  }) => {
    const b = await cargarBandeja(page, api, empresa, evidencia);
    const repetidos = enDosColas(b.review, b.clasificar);
    const inbox = await bandejaDeTrabajo(api, empresa);
    const entreColas = inbox ? repetidosEntreColas(inbox) : [];
    expect
      .soft(
        entreColas,
        `work-inbox: ${entreColas.length} ítem(s) en más de una cola:\n${listar(entreColas)}`,
      )
      .toEqual([]);
    expect(
      repetidos,
      `${repetidos.length} movimiento(s) contados dos veces (Conciliar ${b.review.length} + Clasificar ${b.clasificarTotal}):\n${listar(repetidos)}`,
    ).toEqual([]);
  });

  test("B07 — los calces exactos (RUT y monto al peso) no quedan en revisión manual", async ({
    page,
    api,
    empresa,
    evidencia,
  }) => {
    const b = await cargarBandeja(page, api, empresa, evidencia);
    const exactos = calcesExactosEnRevision(b.review);
    expect(
      exactos,
      `${exactos.length} calce(s) exacto(s) siguen esperando revisión manual (deberían aplicarse y salir de Pagar/Cobrar):\n${listar(exactos)}`,
    ).toEqual([]);
  });

  test("B08 — los pagos fraccionados que suman el documento se proponen juntos", async ({
    page,
    api,
    empresa,
    evidencia,
  }) => {
    const b = await cargarBandeja(page, api, empresa, evidencia);
    const fraccionados = pagosFraccionadosSinCombinar(b.review);
    expect(
      fraccionados,
      `${fraccionados.length} documento(s) con pagos fraccionados propuestos por separado:\n${listar(fraccionados)}`,
    ).toEqual([]);
  });

  test('B12 — en un cargo la tarjeta dice "Salió…" y "por pagar", no "Entró…" ni "por cobrar"', async ({
    page,
    api,
    empresa,
    evidencia,
  }) => {
    const b = await cargarBandeja(page, api, empresa, evidencia);
    const cargos = b.review
      .filter((r) => (r.direction ? r.direction === "debit" : num(r.amount) < 0))
      .filter((r) => (r.suggestion?.documents ?? []).length > 0 || r.suggestion?.document_id)
      .slice(0, 5);
    test.skip(cargos.length === 0, "Hoy no hay cargos con documento propuesto en Conciliar.");
    for (const c of cargos) {
      await page.goto(`/bandeja?tab=conciliar&movimiento=${encodeURIComponent(c.movement_id)}`);
      const carta = page.getByRole("region", { name: "Excepción por conciliar" });
      await expect(carta).toBeVisible();
      const texto = await carta.innerText();
      const ref = `${c.date} ${clp(Math.abs(num(c.amount)), c.currency_code ?? "CLP")} "${c.description ?? ""}"`;
      expect.soft(texto, `cargo ${ref} dice "Entró"`).not.toMatch(/\bEntr[óo]\b/);
      expect.soft(texto, `cargo ${ref} dice "por cobrar"`).not.toMatch(/por cobrar/i);
    }
  });

  test("B13 — sin documento candidato no cita saldos ni promete un Reintentar inexistente, y permite buscar", async ({
    page,
    api,
    empresa,
    evidencia,
  }) => {
    const b = await cargarBandeja(page, api, empresa, evidencia);
    const sinDoc = b.review
      .filter((r) => (r.suggestion?.documents ?? []).length === 0 && !r.suggestion?.document_id)
      .slice(0, 3);
    test.skip(sinDoc.length === 0, "Hoy no hay movimientos sin documento candidato en Conciliar.");
    for (const c of sinDoc) {
      await page.goto(`/bandeja?tab=conciliar&movimiento=${encodeURIComponent(c.movement_id)}`);
      const carta = page.getByRole("region", { name: "Excepción por conciliar" });
      await expect(carta).toBeVisible();
      const texto = await carta.innerText();
      const ref = `${c.date} ${clp(Math.abs(num(c.amount)), c.currency_code ?? "CLP")}`;
      if (/Reintentar/i.test(texto)) {
        await expect
          .soft(
            carta.getByRole("button", { name: /Reintentar/i }),
            `${ref}: el texto menciona "Reintentar" pero no hay botón`,
          )
          .toHaveCount(1);
      }
      if (/No hay ningún documento candidato/i.test(texto)) {
        expect
          .soft(texto, `${ref}: sin candidato, pero el texto cita "saldo" de un documento`)
          .not.toMatch(/saldo/i);
      }
      const buscar = carta.getByRole("button", { name: /Buscar el documento/i });
      if ((await buscar.count()) > 0) {
        // Abrir el buscador es lectura: no confirma ni descarta nada.
        await buscar.first().click();
        await expect
          .soft(
            page
              .getByRole("searchbox")
              .or(page.getByRole("textbox", { name: /buscar|RUT|folio|monto/i })),
            `${ref}: "Buscar el documento" no ofrece un buscador por RUT, folio o monto`,
          )
          .toBeVisible();
        // Sin teclas: la tarjeta tiene atajos (Enter concilia). La guardia igual cortaría la escritura.
      } else {
        expect.soft(false, `${ref}: no hay acción para buscar el documento a mano`).toBe(true);
      }
    }
  });

  test("B14 — la tarjeta usa una sola referencia de días entre documento y pago", async ({
    page,
    api,
    empresa,
    evidencia,
  }) => {
    const b = await cargarBandeja(page, api, empresa, evidencia);
    const conDoc = b.review.filter((r) => (r.suggestion?.documents ?? []).length > 0).slice(0, 5);
    test.skip(conDoc.length === 0, "Hoy no hay propuestas con documento en Conciliar.");
    for (const c of conDoc) {
      await page.goto(`/bandeja?tab=conciliar&movimiento=${encodeURIComponent(c.movement_id)}`);
      const carta = page.getByRole("region", { name: "Excepción por conciliar" });
      await expect(carta).toBeVisible();
      const texto = await carta.innerText();
      const refs = [
        ...texto.matchAll(
          /(a \d+ días? del documento|documento es de hace \d+ días?|hace \d+ días?)/gi,
        ),
      ].map((m) => m[0]);
      expect
        .soft(
          new Set(refs.map((r) => r.toLowerCase())).size,
          `${c.date} ${clp(Math.abs(num(c.amount)))}: la tarjeta trae ${refs.length} referencias de días (${refs.join(" / ")})`,
        )
        .toBeLessThanOrEqual(1);
    }
  });

  test("B15 — el total de Conciliar separa entradas y salidas", async ({
    page,
    api,
    empresa,
    evidencia,
  }) => {
    const b = await cargarBandeja(page, api, empresa, evidencia);
    const d = porDireccion(b.review, "CLP");
    test.skip(
      d.nEntradas === 0 || d.nSalidas === 0,
      "Hoy Conciliar no mezcla entradas y salidas en CLP.",
    );
    const inbox = await bandejaDeTrabajo(api, empresa);
    const cola = inbox?.queues.find((q) => q.kind === "reconciliation");
    const montoCola = num(cola?.amounts.find((a) => (a.currency ?? "CLP") === "CLP")?.amount);
    const mezcla = d.entradas + d.salidas;
    evidencia.nota(
      `Conciliar CLP: entradas ${clp(d.entradas)} (${d.nEntradas}), salidas ${clp(d.salidas)} (${d.nSalidas}); work-inbox informa ${clp(montoCola)}`,
    );
    expect(
      Math.abs(montoCola - mezcla) < 1,
      `El total de Conciliar (${clp(montoCola)}) suma entradas ${clp(d.entradas)} + salidas ${clp(d.salidas)}: debería informarlas por separado`,
    ).toBe(false);
    // La pantalla tampoco debería mostrar la suma mezclada como un solo total.
    await expect(page.getByText(clp(mezcla), { exact: false })).toHaveCount(0);
  });

  test("B22 — el pago de nómina no cae en Clasificar sin sugerencia: se concilia contra la planilla del mes", async ({
    page,
    api,
    empresa,
    evidencia,
  }) => {
    const b = await cargarBandeja(page, api, empresa, evidencia);
    const nomina = b.clasificar.filter((m) => m.financial_event_type === "payroll_payment");
    expect(
      nomina.map((m) => `${m.date} ${clp(Math.abs(num(m.amount)))} "${m.description}" [${m.id}]`),
      `${nomina.length} pago(s) de nómina marcados payroll_payment siguen en Clasificar`,
    ).toEqual([]);
  });
});
