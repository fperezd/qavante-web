import { expect, test } from "@playwright/test";
import { loginAs } from "../helpers";
import { DOCE } from "./support/doce";
import type { Medicion } from "./support/medicion";
import {
  abrirPantalla,
  leerDeTexto,
  leerKpi,
  leerMetricCard,
  leerPendientesBandeja,
  type NombrePantalla,
} from "./support/superficies";

/* LA MITAD DE CI DEL GATE. Corre contra MSW en localhost, sin sesión de producción, y tiene que
   quedar VERDE y determinista.

   QUÉ PRUEBA. No prueba que las cifras del tenant coincidan — para eso está `invariantes.spec.ts`
   contra producción, y los fixtures de MSW no son el tenant. Prueba el INSTRUMENTO: que cada lector
   que el gate va a usar en producción ENCUENTRA la cifra en la pantalla montada de verdad.

   POR QUÉ IMPORTA, y por qué sin esto el gate de producción es una promesa. Si mañana alguien
   renombra la región "Hoy, entra y sale" o la etiqueta "Entra · 14 días", el run de producción no
   se pondría rojo: se pondría `no-medible`, que sí falla, pero falla por el motivo equivocado y
   obliga a investigar en producción algo que un test de CI podía haber dicho antes. Peor: si alguien
   "arregla" ese ruido relajando el lector, el gate de producción pasa a comparar menos superficies y
   nadie lo nota. Este archivo es el que hace que ese cambio se caiga en el PR.

   Cada caso afirma PRESENCIA Y VALOR: el lector tiene que devolver `medido`, no basta con que no
   explote. Un `noMedible` acá es una falla con el motivo adentro. */

/** Falla cuando el lector NO pudo medir una cifra que la pantalla sí publica. */
function exigirMedido(m: Medicion, que: string): number {
  expect(
    m.medido,
    `${que}
El lector NO encontró la cifra: ${m.medido ? "" : m.motivo}
Fuente: ${m.fuente}`,
  ).toBe(true);
  // El narrow para TypeScript; el expect de arriba ya falló si no se midió.
  if (!m.medido) throw new Error(m.motivo);
  return m.valor;
}

/* Las dos razones por las que un lector no mide, que NO son la misma cosa:

     (a) EL SELECTOR NO ENGANCHÓ — la tarjeta, la región o la etiqueta cambiaron de nombre, o la
         pantalla no cargó. Es un defecto del gate y se arregla acá. En CI tiene que FALLAR, porque
         si no, el run de producción mediría de menos y nadie se enteraría.
     (b) EL PRODUCTO NO TIENE LA CIFRA — la tarjeta está, el selector la encontró, y lo que publica
         es "sin dato" o una acción ("Volver a calcular", "Conciliación por cerrar"). Eso es la
         VERDAD de los fixtures, no un defecto del lector. En CI se reporta y se deja pasar; es
         contra producción donde el invariante decide si eso es aceptable, y allá no lo es: devuelve
         `no-medible` y falla.

   Sin esta distinción habría que elegir entre dos males: o CI falla por lo que el mock no tiene
   (y entonces se relaja el lector, que es cómo el gate deja de medir), o CI deja pasar cualquier
   `noMedible` (y entonces una etiqueta renombrada no se nota hasta producción). */
const SELECTOR_NO_ENGANCHO =
  /no está en |no está en la pantalla|no se montó|no cargó|respondió \d|no publica ningún texto|ni el bloque work-inbox|no publica un título|no publica un contador|no publica un slot/;

function exigirLectorFunciona(m: Medicion, que: string): void {
  if (m.medido) return;
  const esSelector = SELECTOR_NO_ENGANCHO.test(m.motivo);
  expect(
    esSelector,
    `${que}
EL SELECTOR DEL GATE NO ENGANCHÓ, que es un defecto del gate y no del dato: ${m.motivo}
Fuente: ${m.fuente}`,
  ).toBe(false);
  /* Llegó acá: el selector encontró el elemento y el producto no publica cifra. Se deja constancia
     en el reporte en vez de callarlo, porque un lector que nunca mide nada tampoco sirve. */
  test.info().annotations.push({
    type: "el producto no publica cifra",
    description: `${que}: ${m.motivo}`,
  });
}

test.describe("Los lectores del gate encuentran la cifra en las pantallas montadas", () => {
  test.beforeEach(async ({ context }) => {
    await loginAs(context, "owner");
  });

  test("Caja publica las tres cifras que comparan los invariantes 1, 2 y 3", async ({ page }) => {
    const caja = await abrirPantalla(page, "caja");
    expect(caja.fallo, `no se pudo abrir /caja: ${caja.fallo}`).toBeNull();

    /* Las tres etiquetas son las del código de la vista
       (`src/components/caja/v02/caja-v02-model.ts`): "Hoy", y "Entra · 14 días" / "Sale · 14 días"
       armadas con VENTANA_DIAS. El punto medio es U+00B7, no un guion: escribirlo mal deja el
       lector sin encontrar nada y el gate midiendo de menos. */
    const hoy = await leerKpi(caja, { region: "Hoy, entra y sale", etiqueta: "Hoy" });
    exigirMedido(hoy, 'INV-01: el KPI "Hoy" de Caja');

    const entra = await leerKpi(caja, { region: "Hoy, entra y sale", etiqueta: "Entra · 14 días" });
    exigirMedido(entra, 'INV-02: el KPI "Entra · 14 días" de Caja');

    const sale = await leerKpi(caja, { region: "Hoy, entra y sale", etiqueta: "Sale · 14 días" });
    exigirMedido(sale, 'INV-03: el KPI "Sale · 14 días" de Caja');
  });

  test("Banco publica Caja hoy y el total por moneda que mide el invariante 5", async ({
    page,
  }) => {
    const banco = await abrirPantalla(page, "banco");
    expect(banco.fallo, `no se pudo abrir /banco: ${banco.fallo}`).toBeNull();

    const cajaHoy = await leerKpi(banco, { region: "Caja hoy", etiqueta: "Caja hoy" });
    exigirMedido(cajaHoy, 'INV-01: el KPI "Caja hoy" de Banco');

    /* INV-05 se mide sobre esta línea. El fixture de MSW trae una cuenta CLP y una USD, así que la
       línea tiene que nombrar DOS monedas: si publicara una sola cifra, estaría sumando monedas. */
    const linea = banco.page.getByText(/^Saldo contable según el banco, por moneda:/);
    await expect(
      linea,
      "INV-05: /banco no publica el total por moneda; sin esa línea el invariante de moneda no tiene qué leer",
    ).toBeVisible();
    const texto = (await linea.first().innerText()).replace(/\s+/g, " ");
    const monedas = [...new Set(texto.match(/\b(CLP|USD|EUR|UF)\b/g) ?? [])];
    expect(
      monedas.length,
      `INV-05: con cuentas en más de una moneda la línea debe nombrar cada una por separado. Decía: "${texto}"`,
    ).toBeGreaterThanOrEqual(2);
    expect(texto, "INV-05: la vista debe declarar que no suma monedas entre sí").toContain(
      "Las monedas no se suman entre sí",
    );
  });

  test("Cobrar publica el total por cobrar que compara el invariante 2", async ({ page }) => {
    const cobrar = await abrirPantalla(page, "cobrar");
    expect(cobrar.fallo, `no se pudo abrir /cobrar: ${cobrar.fallo}`).toBeNull();
    /* OJO: la tarjeta de /cobrar es un `MetricCard` del módulo de cobranza, no un `KpiCard` del
       rediseño, así que no trae `data-kpi` y necesita su propio lector. Dos componentes distintos
       con el mismo nombre en la pantalla es exactamente cómo un lector escrito de memoria falla. */
    const porCobrar = await leerMetricCard(cobrar, {
      region: "Resumen de cobranza",
      etiqueta: "Por cobrar",
    });
    /* Esta tarjeta publica la ventana de los próximos 7 días, o una acción cuando la conciliación
       está por cerrar (`recuadroPorCobrar` / `collectedMetric` en `gestion-cobros-live.tsx`). Lo que
       CI exige es que el selector la encuentre; si lo que trae es una cifra o un rótulo lo decide el
       dato, y es el invariante contra producción el que juzga si eso alcanza. */
    exigirLectorFunciona(porCobrar, 'INV-02: la tarjeta "Por cobrar" de Cobrar');
    await expect(
      cobrar.page.locator('[data-metric="Por cobrar"]'),
      'INV-02: /cobrar debe montar la tarjeta "Por cobrar"; sin ella el invariante no tiene qué leer',
    ).toHaveCount(1);
  });

  test("Pagar publica el total por pagar que compara el invariante 3", async ({ page }) => {
    const pagar = await abrirPantalla(page, "pagar");
    expect(pagar.fallo, `no se pudo abrir /pagar: ${pagar.fallo}`).toBeNull();
    const porPagar = await leerKpi(pagar, {
      region: "Vencido, por pagar y caja proyectada",
      etiqueta: "Por pagar",
    });
    exigirMedido(porPagar, 'INV-03: el KPI "Por pagar" de Pagar');
  });

  test("Bandeja publica el contador de pendientes que compara el invariante 4", async ({
    page,
  }) => {
    const bandeja = await abrirPantalla(page, "bandeja");
    expect(bandeja.fallo, `no se pudo abrir /bandeja: ${bandeja.fallo}`).toBeNull();
    const pendientes = await leerPendientesBandeja(bandeja);
    /* Acá el lector puede devolver 0 legítimamente ("Nada espera tu decisión"), y eso SÍ es una
       medición: es un cero que el producto afirma. Lo que no puede devolver es `noMedible`, porque
       entonces el invariante 4 no tendría de dónde leer el contador en producción. */
    const n = exigirMedido(pendientes, "INV-04: el contador de pendientes de la Bandeja");
    expect(n, "el contador no puede ser negativo").toBeGreaterThanOrEqual(0);
  });

  test("todas las pantallas del gate se abren y montan su ancla", async ({ page }) => {
    /* Un barrido tiene que decir sobre QUÉ barrió. La lista se afirma antes de recorrerla: si
       quedara vacía, este test pasaría sin abrir nada, que es el barrido que concluye "todas
       verdes" sobre una lista vacía. */
    const pantallas: NombrePantalla[] = [
      "inicio",
      "caja",
      "banco",
      "cobrar",
      "pagar",
      "bandeja",
      "alertas",
      "salud",
      "remuneraciones",
      "f29",
    ];
    expect(pantallas.length, "el barrido de pantallas quedó vacío").toBe(10);
    const fallos: string[] = [];
    for (const nombre of pantallas) {
      const p = await abrirPantalla(page, nombre);
      if (p.fallo) fallos.push(`${nombre} (${p.ruta}): ${p.fallo}`);
    }
    expect(
      fallos,
      `las anclas de estas pantallas no se montaron, así que el gate de producción no podría medirlas:\n${fallos.join("\n")}`,
    ).toEqual([]);
  });

  test("el inventario de los doce invariantes acompaña a los lectores", () => {
    // Si el gate adelgaza, se cae acá y no en producción.
    expect(DOCE).toHaveLength(12);
    expect(DOCE.map((d) => d.id)).toEqual([
      "INV-01",
      "INV-02",
      "INV-03",
      "INV-04",
      "INV-05",
      "INV-06",
      "INV-07",
      "INV-08",
      "INV-09",
      "INV-10",
      "INV-11",
      "INV-12",
    ]);
  });
});

test.describe("El lector se niega a medir lo que no está", () => {
  test("una ruta ausente NO se lee como una cifra faltante", async ({ page, context }) => {
    await loginAs(context, "owner");
    /* El gemelo de `abrir()`: si una ruta devolviera 404 y el lector siguiera adelante, el gate
       reportaría "la tarjeta no está" cuando el problema es que la PANTALLA no existe. Son dos
       arreglos distintos y el mensaje tiene que distinguirlos. */
    const { abrir } = await import("./support/superficies");
    const fantasma = await abrir(page, "fantasma", "/ruta-que-no-existe-qa-gate", {
      ancla: (p) => p.getByRole("region", { name: "Hoy, entra y sale" }),
      anclaNombre: "una región que no existe",
    });
    expect(
      fantasma.fallo,
      "una ruta ausente tiene que dejar la pantalla inservible para medir",
    ).not.toBeNull();

    const m = await leerKpi(fantasma, { etiqueta: "Hoy" });
    expect(m.medido, "se leyó una cifra de una pantalla que no cargó").toBe(false);
    if (!m.medido) {
      expect(
        m.motivo,
        "el motivo tiene que nombrar que la pantalla no cargó, no que falte la tarjeta",
      ).toContain("/ruta-que-no-existe-qa-gate");
    }
  });

  test("una tarjeta que no está devuelve 'no pude medir', nunca un cero", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    const caja = await abrirPantalla(page, "caja");
    const m = await leerKpi(caja, {
      region: "Hoy, entra y sale",
      etiqueta: "Etiqueta que no existe en ninguna vista",
    });
    expect(m.medido, "se midió una tarjeta inexistente").toBe(false);
  });

  test("un texto en prosa que no está devuelve 'no pude medir'", async ({ page, context }) => {
    await loginAs(context, "owner");
    const caja = await abrirPantalla(page, "caja");
    const m = await leerDeTexto(caja, "frase inventada", /(\d+) unicornios pendientes/, {
      comoEntero: true,
    });
    expect(m.medido, "se midió una frase que la pantalla no publica").toBe(false);
  });
});
