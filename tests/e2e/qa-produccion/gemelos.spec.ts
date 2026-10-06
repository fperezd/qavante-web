import { expect, test } from "@playwright/test";
import {
  DOCE,
  inv01CajaHoy,
  inv02PorCobrar,
  inv03PorPagar,
  inv04Pendientes,
  inv05Moneda,
  inv06Sociedad,
  inv07Identidad,
  inv08Fechas,
  inv09Payroll,
  inv10F29,
  inv11D08,
  inv12PulsoQhs,
} from "./support/doce";
import { medido, mismaCifra, noMedible, type Veredicto } from "./support/medicion";
import { conEspera, leerMonto, MONEDA_SIN_DECLARAR } from "./support/superficies";

/* LOS GEMELOS. NO pegan a ninguna red ni abren ningún navegador: son puros, deterministas y corren
   igual en CI y contra producción.

   QUÉ PRUEBAN, y por qué el gate no vale nada sin ellos. Un invariante en verde sólo significa algo
   si existe una verdad distinta que lo habría puesto rojo. La noche del 05-10-2026 ocho instrumentos
   estaban en verde porque medían otra cosa; uno concluía "todas verdes" barriendo una lista vacía.
   Para cada uno de los doce invariantes, su gemelo siembra tres mundos:

     · CONSISTENTE   → el invariante dice `coinciden`. Si acá dijera otra cosa, el invariante sería
                       un rojo permanente y nadie lo miraría.
     · UNA CIFRA MÁS → se cambia UNA sola cifra. El invariante DEBE decir `divergen`. Si siguiera en
                       `coinciden`, la comparación no compara: es el instrumento que mide otra cosa.
     · UNA CIFRA MENOS → se BORRA una cifra. El invariante DEBE decir `no-medible`, nunca
                       `coinciden`. Es la prueba de que una ausencia no pasa por una coincidencia.

   Y los gemelos de los LECTORES: un rótulo de ausencia ("sin dato", "s/d", "Sin información") no
   puede leerse como un cero, y un cero de verdad sí tiene que leerse como cero. */

const CLP = "CLP";

function assertVeredicto(v: Veredicto, esperado: Veredicto["estado"], que: string) {
  expect(v.estado, `${que}\n${v.concepto}\n${v.detalle}`).toBe(esperado);
}

test.describe("INV-00 · el inventario del gate", () => {
  test("INV-00 son exactamente doce invariantes, con id único y enunciado", () => {
    /* Este test existe para que el gate no pueda adelgazar en silencio. Si alguien borra un
       invariante o lo deja sin registrar, acá se cae: un gate de once invariantes que se anuncia
       como el de doce es la misma falla que el barrido sobre la lista vacía. */
    expect(DOCE, "el gate del dueño son DOCE invariantes").toHaveLength(12);
    expect(new Set(DOCE.map((d) => d.id)).size, "hay ids repetidos").toBe(12);
    for (const [i, ficha] of DOCE.entries()) {
      expect(ficha.id, `el invariante ${i + 1} no está numerado como corresponde`).toBe(
        `INV-${String(i + 1).padStart(2, "0")}`,
      );
      expect(ficha.enunciado.length, `${ficha.id} no trae enunciado`).toBeGreaterThan(10);
      expect(
        ficha.superficies.length,
        `${ficha.id} compara menos de dos superficies: no es un invariante cruzado`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  test("INV-00 toda superficie excluida en MSW trae el motivo nombrado", () => {
    /* Una reducción del instrumento contra MSW es legítima (el mock no tiene nueve sociedades),
       pero tiene que estar DECLARADA y con motivo. Una exclusión muda es cómo un gate se pone
       verde sin medir. */
    for (const ficha of DOCE) {
      for (const r of ficha.reducidoEnMsw) {
        expect(r.superficie.length, `${ficha.id}: exclusión sin superficie`).toBeGreaterThan(0);
        expect(
          r.motivo.length,
          `${ficha.id}: la superficie "${r.superficie}" se excluye en MSW sin motivo escrito`,
        ).toBeGreaterThan(40);
      }
      // Nunca se puede excluir TODO: un invariante sin brazos en MSW no se verifica en CI.
      expect(
        ficha.reducidoEnMsw.length,
        `${ficha.id} excluye todas sus superficies en MSW: en CI no verificaría nada`,
      ).toBeLessThan(ficha.superficies.length);
    }
  });
});

test.describe("Gemelos de los doce invariantes", () => {
  test("INV-01 Caja hoy — coincide, se parte con una cifra distinta, y se niega sin una de las cuatro", () => {
    const base = {
      inicio: medido("Inicio · Saldo bancario", 9_800_000, CLP, "$9.800.000"),
      caja: medido("Caja · KPI Hoy", 9_800_000, CLP, "$9.800.000"),
      banco: medido("Banco · KPI Caja hoy", 9_800_000, CLP, "$9.800.000"),
      api: medido("API · cash_today.total", 9_800_000, CLP, "9800000"),
    };
    assertVeredicto(inv01CajaHoy(base), "coinciden", "cuatro superficies con la misma cifra");

    // La cifra sembrada distinta es la de producción medida el 06-10-2026: las cuentas sin sociedad
    // suman −5.709.111 y las de Tooxs 6.326.119, así que Inicio y Banco no pueden dar lo mismo.
    assertVeredicto(
      inv01CajaHoy({
        ...base,
        banco: medido("Banco · KPI Caja hoy", 6_326_119, CLP, "$6.326.119"),
      }),
      "divergen",
      "Banco publica otra cifra y el invariante NO lo nota",
    );
    assertVeredicto(
      inv01CajaHoy({
        ...base,
        inicio: medido("Inicio · Saldo bancario", 616_008, CLP, "$616.008"),
      }),
      "divergen",
      "Inicio suma las cuentas sin sociedad y el invariante NO lo nota",
    );

    assertVeredicto(
      inv01CajaHoy({
        ...base,
        banco: noMedible("Banco · KPI Caja hoy", 'la tarjeta dice "sin dato"'),
      }),
      "no-medible",
      'un "sin dato" en Banco se está leyendo como coincidencia',
    );
    // Y la trampa fina: tres de cuatro coinciden y la cuarta no se midió. Eso NO es coincidir.
    assertVeredicto(
      inv01CajaHoy({ ...base, api: noMedible("API · cash_today.total", "el bloque no vino") }),
      "no-medible",
      "tres superficies de acuerdo bastan para declarar el invariante satisfecho",
    );
  });

  test("INV-02 Por cobrar — coincide, se parte, y se niega sin la cifra de Cobrar", () => {
    const base = {
      caja: medido("Caja · KPI Entra · 14 días", 24_800_000, CLP, "+$24.800.000"),
      pantallaPropia: medido("Cobrar · total por cobrar", 24_800_000, CLP, "$24.800.000"),
      api: medido("API · accounts-receivable.total", 24_800_000, CLP, "24800000"),
    };
    assertVeredicto(inv02PorCobrar(base), "coinciden", "tres puntos con la misma cifra");
    /* La cifra sembrada es la de producción: 185 cuentas vivas por $364.846.883, ninguna con
       `due_date`, así que la ventana de 14 días recoge $0 mientras el total sigue arriba. */
    assertVeredicto(
      inv02PorCobrar({ ...base, caja: medido("Caja · KPI Entra · 14 días", 0, CLP, "+$0") }),
      "divergen",
      'Caja publica "+$0" sobre $24,8M por cobrar y el invariante NO lo nota',
    );
    assertVeredicto(
      inv02PorCobrar({
        ...base,
        pantallaPropia: noMedible("Cobrar · total por cobrar", "el encabezado no publica el total"),
      }),
      "no-medible",
      "Cobrar sin cifra se está leyendo como coincidencia",
    );
  });

  test("INV-03 Por pagar — coincide, se parte, y se niega sin la cifra de la API", () => {
    const base = {
      caja: medido("Caja · KPI Sale · 14 días", -3_700_000, CLP, "−$3.700.000"),
      pantallaPropia: medido("Pagar · total comprometido", -3_700_000, CLP, "−$3.700.000"),
      api: medido("API · accounts-payable.due_14d", -3_700_000, CLP, "-3700000"),
    };
    assertVeredicto(inv03PorPagar(base), "coinciden", "tres puntos con la misma cifra");
    assertVeredicto(
      inv03PorPagar({
        ...base,
        api: medido("API · accounts-payable.due_14d", -6_200_000, CLP, "-6200000"),
      }),
      "divergen",
      "la API publica otro due_14d que la pantalla y el invariante NO lo nota",
    );
    // El signo también es la verdad: un KPI que publica el monto en positivo divergió.
    assertVeredicto(
      inv03PorPagar({
        ...base,
        pantallaPropia: medido("Pagar · total comprometido", 3_700_000, CLP, "$3.700.000"),
      }),
      "divergen",
      "Pagar invierte el signo y el invariante NO lo nota",
    );
    assertVeredicto(
      inv03PorPagar({
        ...base,
        api: noMedible("API · accounts-payable.due_14d", "la respuesta no trae due_14d"),
      }),
      "no-medible",
      "la API sin due_14d se está leyendo como coincidencia",
    );
  });

  test("INV-04 Pendientes — tolerancia cero: un movimiento de diferencia ya es divergencia", () => {
    const base = {
      caja: medido("Caja · aviso de pendientes", 27, "unidades", "27"),
      pantallaPropia: medido("Bandeja · contador", 27, "unidades", "27"),
      api: medido("API · work-inbox classification.count", 27, "unidades", "27"),
    };
    assertVeredicto(inv04Pendientes(base), "coinciden", "tres contadores iguales");
    assertVeredicto(
      inv04Pendientes({ ...base, api: medido("API · work-inbox", 28, "unidades", "28") }),
      "divergen",
      "un solo movimiento de diferencia no se nota: la tolerancia no es cero",
    );
    assertVeredicto(
      inv04Pendientes({
        ...base,
        pantallaPropia: noMedible("Bandeja · contador", "el título no publica el número"),
      }),
      "no-medible",
      "la Bandeja sin contador se está leyendo como coincidencia",
    );
  });

  test("INV-05 Moneda — se parte con un KPI que recibe dos monedas y publica una cifra", () => {
    const separado = [
      {
        kpi: "Saldo contable según el banco, por moneda",
        monedasDeOrigen: ["CLP", "USD"],
        monedasPublicadas: ["CLP", "USD"],
      },
    ];
    assertVeredicto(inv05Moneda(separado), "coinciden", "el KPI publica un subtotal por moneda");
    assertVeredicto(
      inv05Moneda([
        {
          kpi: "Saldo contable según el banco, por moneda",
          monedasDeOrigen: ["CLP", "USD"],
          monedasPublicadas: ["CLP"],
        },
      ]),
      "divergen",
      "un KPI alimentado por CLP y USD publica una sola cifra y el invariante NO lo nota",
    );
    /* El gemelo que importa más: si NINGÚN KPI recibe dos monedas, el invariante no puede concluir.
       En producción hay 21 abonos y 22 cargos en USD, así que el caso existe; un barrido que no los
       encuentra está midiendo otra cosa y tiene que decirlo, no pasar. */
    assertVeredicto(
      inv05Moneda([{ kpi: "Hoy", monedasDeOrigen: ["CLP"], monedasPublicadas: ["CLP"] }]),
      "no-medible",
      'sin un KPI de moneda mezclada, "no suma monedas" se está declarando sin mirar',
    );
    assertVeredicto(
      inv05Moneda([]),
      "no-medible",
      "un barrido sobre cero KPI concluye que todo está bien",
    );
  });

  test("INV-06 Sociedad — $0 propio pasa, la cifra de otra sociedad se parte, y sin sociedad vacía no concluye", () => {
    const vacia = "77c2808e-5fbc-4abd-9b5b-3a6d60e2838f";
    const tooxs = "09a971b1-8bb6-4e11-b260-c47b07fbb61b";
    assertVeredicto(
      inv06Sociedad({
        sociedad: vacia,
        propia: medido("Caja · KPI Hoy", 0, CLP, "$0"),
        deOtras: [{ sociedad: tooxs, valor: 6_326_119 }],
      }),
      "coinciden",
      "una sociedad sin cuentas publica $0 propio",
    );
    assertVeredicto(
      inv06Sociedad({
        sociedad: vacia,
        propia: medido("Caja · KPI Hoy", 6_326_119, CLP, "$6.326.119"),
        deOtras: [{ sociedad: tooxs, valor: 6_326_119 }],
      }),
      "divergen",
      "la sociedad vacía muestra la cifra de Tooxs y el invariante NO lo nota",
    );
    assertVeredicto(
      inv06Sociedad({
        sociedad: vacia,
        propia: medido("Caja · KPI Hoy", 616_008, CLP, "$616.008"),
        deOtras: [{ sociedad: tooxs, valor: 6_326_119 }],
      }),
      "divergen",
      "la sociedad vacía publica una cifra propia distinta de cero y el invariante NO lo nota",
    );
    assertVeredicto(
      inv06Sociedad({
        sociedad: vacia,
        propia: noMedible("Caja · KPI Hoy", 'la tarjeta dice "sin dato"'),
        deOtras: [{ sociedad: tooxs, valor: 6_326_119 }],
      }),
      "no-medible",
      'un "sin dato" en la sociedad vacía se está leyendo como aislamiento probado',
    );
    assertVeredicto(
      inv06Sociedad(null),
      "no-medible",
      "sin una sociedad vacía con la que medir, el invariante se declara satisfecho",
    );
  });

  test("INV-07 Identidad — una contradicción se parte, y cero propuestas con RUT no concluye", () => {
    assertVeredicto(
      inv07Identidad({ propuestasConRutEnGlosa: 23, contradictorias: [] }),
      "coinciden",
      "23 propuestas con RUT y ninguna contradictoria",
    );
    assertVeredicto(
      inv07Identidad({
        propuestasConRutEnGlosa: 23,
        contradictorias: [
          "glosa con RUT 76008959-1 propuesta contra el folio 1234 de otro RUT (77987654-3)",
        ],
      }),
      "divergen",
      "una propuesta con RUT contradictorio y el invariante NO lo nota",
    );
    /* Este es el gemelo que fija el hallazgo medido hoy: `treasury.receivables` tiene 495 filas con
       CERO `counterparty_key` y `counterparty_capabilities` está vacía. Un barrido sin propuestas
       que examinar no puede concluir que la identidad está sana. */
    assertVeredicto(
      inv07Identidad({ propuestasConRutEnGlosa: 0, contradictorias: [] }),
      "no-medible",
      "cero propuestas con RUT y el invariante declara la identidad sana",
    );
  });

  test("INV-08 Fechas — una fecha futura se parte, y un día de negocio en UTC se parte", () => {
    const sano = {
      diaDeNegocio: "2026-10-06",
      registrosExaminados: 808,
      posteriores: [],
      hoyEnPantalla: "2026-10-06",
    };
    assertVeredicto(inv08Fechas(sano), "coinciden", "808 registros, ninguno futuro, hoy correcto");
    assertVeredicto(
      inv08Fechas({ ...sano, posteriores: ["mov 2026-10-07 por $1.200.000"] }),
      "divergen",
      "un movimiento fechado mañana y el invariante NO lo nota",
    );
    /* El gemelo del huso: en Chile el día civil cambia tres o cuatro horas antes que en UTC, así
       que entre las 21:00 y la medianoche de Santiago un cálculo en UTC publica el día siguiente. */
    assertVeredicto(
      inv08Fechas({ ...sano, hoyEnPantalla: "2026-10-07" }),
      "divergen",
      "la pantalla resuelve el día en UTC y el invariante NO lo nota",
    );
    assertVeredicto(
      inv08Fechas({ ...sano, registrosExaminados: 0 }),
      "no-medible",
      "cero registros fechados y el invariante declara las fechas sanas",
    );
    assertVeredicto(
      inv08Fechas({ ...sano, hoyEnPantalla: null }),
      "no-medible",
      'la pantalla no publica su "hoy" y el invariante lo da por bueno',
    );
  });

  test("INV-09 Payroll — obligación, pago y asignación; se parte si la asignación no cubre el pago", () => {
    const base = {
      periodo: "2026-09",
      obligacion: medido("API · obligación de nómina", 4_200_000, CLP, "4200000"),
      pago: medido("API · pago de nómina", 4_200_000, CLP, "4200000"),
      asignacion: medido("API · asignación pago→obligación", 4_200_000, CLP, "4200000"),
    };
    assertVeredicto(inv09Payroll(base), "coinciden", "las tres patas cuadran");
    assertVeredicto(
      inv09Payroll({
        ...base,
        asignacion: medido("API · asignación pago→obligación", 0, CLP, "0"),
      }),
      "divergen",
      "el pago existe pero no está asignado a la obligación y el invariante NO lo nota",
    );
    assertVeredicto(
      inv09Payroll({
        ...base,
        asignacion: noMedible(
          "API · asignación pago→obligación",
          "la respuesta no publica la asignación",
        ),
      }),
      "no-medible",
      "sin la asignación, obligación == pago se está leyendo como consistencia",
    );
  });

  test("INV-10 F29 — declarado == pagado + residual; se parte si el residual no explica la diferencia", () => {
    const base = {
      periodo: "2026-08",
      declarado: medido("API · F29 declarado", 2_400_000, CLP, "2400000"),
      pagado: medido("API · F29 pagado", 1_900_000, CLP, "1900000"),
      residual: medido("API · F29 residual", 500_000, CLP, "500000"),
    };
    assertVeredicto(inv10F29(base), "coinciden", "1.900.000 + 500.000 = 2.400.000");
    assertVeredicto(
      inv10F29({ ...base, residual: medido("API · F29 residual", 0, CLP, "0") }),
      "divergen",
      "se declararon 2,4M, se pagaron 1,9M y el residual dice 0: el invariante NO lo nota",
    );
    assertVeredicto(
      inv10F29({ ...base, residual: noMedible("API · F29 residual", "el giro no responde") }),
      "no-medible",
      "sin residual, declarado y pagado se están leyendo como consistentes",
    );
  });

  test("INV-11 D08 — un UUID distinto por superficie se parte, y un UUID ausente no concluye", () => {
    const uuid = "3f2a9c10-7b41-4f0e-9a52-6d1c8e4b7a33";
    assertVeredicto(
      inv11D08({
        contraparte: "Constructora Andes SpA",
        porSuperficie: [
          { superficie: "Cobrar", uuid },
          { superficie: "Pagar", uuid },
          { superficie: "API receivables", uuid },
        ],
      }),
      "coinciden",
      "tres superficies con el mismo UUID",
    );
    assertVeredicto(
      inv11D08({
        contraparte: "Constructora Andes SpA",
        porSuperficie: [
          { superficie: "Cobrar", uuid },
          { superficie: "Pagar", uuid: "9b8c7d6e-5f4a-3b2c-1d0e-9f8a7b6c5d4e" },
        ],
      }),
      "divergen",
      "la misma contraparte con dos UUID y el invariante NO lo nota",
    );
    /* El gemelo que fija el hallazgo medido hoy: 495 `receivables` y 765 `payables`, ninguno con
       `counterparty_key`. Sin UUID no hay identidad que comparar, y eso es "no pude medir". */
    assertVeredicto(
      inv11D08({
        contraparte: "Constructora Andes SpA",
        porSuperficie: [
          { superficie: "Cobrar", uuid, motivoSiFalta: "" },
          {
            superficie: "API receivables",
            uuid: null,
            motivoSiFalta: "ninguna fila trae counterparty_key",
          },
        ],
      }),
      "no-medible",
      "una superficie sin UUID y el invariante declara la identidad única",
    );
    assertVeredicto(
      inv11D08({
        contraparte: "Constructora Andes SpA",
        porSuperficie: [{ superficie: "Cobrar", uuid }],
      }),
      "no-medible",
      "una sola superficie y el invariante declara la identidad única",
    );
  });

  test("INV-12 PULSO y QHS — una frase tranquilizadora con brecha declarada se parte", () => {
    assertVeredicto(
      inv12PulsoQhs({
        brechaDeCaja: true,
        veredictos: [
          { nombre: "PULSO", texto: "La cobranza más lenta frena tu Pulso." },
          { nombre: "QHS", texto: "Hay un faltante proyectado en los próximos 14 días." },
        ],
      }),
      "coinciden",
      "con brecha declarada, ninguno tranquiliza",
    );
    assertVeredicto(
      inv12PulsoQhs({
        brechaDeCaja: true,
        veredictos: [
          {
            nombre: "PULSO",
            texto: "La caja proyectada cubre las obligaciones críticas de 14 días.",
          },
          { nombre: "QHS", texto: "Hay un faltante proyectado en los próximos 14 días." },
        ],
      }),
      "divergen",
      "PULSO dice que la caja cubre mientras Caja declara brecha y el invariante NO lo nota",
    );
    assertVeredicto(
      inv12PulsoQhs({
        brechaDeCaja: null,
        veredictos: [
          { nombre: "PULSO", texto: "Tu Pulso está estable." },
          { nombre: "QHS", texto: "Pagos cubiertos." },
        ],
      }),
      "no-medible",
      "sin saber si hay brecha, el invariante declara que no se contradicen",
    );
    assertVeredicto(
      inv12PulsoQhs({
        brechaDeCaja: true,
        veredictos: [
          { nombre: "PULSO", texto: "Tu Pulso está estable." },
          { nombre: "QHS", texto: null },
        ],
      }),
      "no-medible",
      "QHS mudo y el invariante declara que no contradice a Caja",
    );
  });
});

test.describe("Gemelos de los lectores: una ausencia no es un cero", () => {
  test("los cuatro rótulos de ausencia del producto NO se leen como cero", () => {
    /* Los rótulos son los que publica el producto: `sin dato` y `Sin información` de
       `src/components/rediseno/sin-dato.tsx`, `s/d` de `src/lib/formatters/clp.ts` y
       `En revisión` de `src/lib/formatters/amount.ts`. Si alguno se leyera como 0, el gate
       compararía ceros inventados y diría que todo coincide. */
    for (const rotulo of [
      "sin dato",
      "Sin dato",
      "Sin información",
      "s/d",
      "En revisión",
      "",
      "   ",
    ]) {
      expect(leerMonto(rotulo), `"${rotulo}" se está leyendo como un número`).toBeNull();
    }
  });

  test("un cero de verdad SÍ se lee como cero", () => {
    // Faltante no es cero, y cero no es faltante: el gate necesita las dos cosas separadas.
    expect(leerMonto("$0")).toEqual({ valor: 0, moneda: "CLP" });
    expect(leerMonto("+$0")).toEqual({ valor: 0, moneda: "CLP" });
  });

  test("el menos tipográfico U+2212 se lee como negativo, no como un positivo", () => {
    /* `formatClp` antepone U+2212 antes del signo peso ("−$300.000"). Un lector que sólo entienda
       el guion ASCII leería 300.000 positivo, y el gate compararía −5.709.111 contra +5.709.111
       como si coincidieran en magnitud. */
    expect(leerMonto("−$5.709.111")).toEqual({ valor: -5_709_111, moneda: "CLP" });
    expect(leerMonto("-$5.709.111")).toEqual({ valor: -5_709_111, moneda: "CLP" });
    expect(leerMonto("$5.709.111")).toEqual({ valor: 5_709_111, moneda: "CLP" });
  });

  test("la moneda se lee del prefijo, y US$ no se confunde con pesos", () => {
    // Invariante 5 depende de esto: si US$ se leyera como CLP, una suma mezclada pasaría inadvertida.
    expect(leerMonto("US$ 1.200,00")).toEqual({ valor: 1200, moneda: "USD" });
    expect(leerMonto("−US$ 270,40")).toEqual({ valor: -270.4, moneda: "USD" });
    expect(leerMonto("EUR 1.234,50")).toEqual({ valor: 1234.5, moneda: "EUR" });
    expect(leerMonto("$1.234")).toEqual({ valor: 1234, moneda: "CLP" });
  });

  test("una moneda no declarada NO se rellena con pesos", () => {
    /* `formatMoney` rinde el monto sin código ISO como «1.234,50 · moneda no informada»
       (`MONEDA_NO_INFORMADA` en `src/lib/formatters/clp.ts`, #430). El lector tiene que conservar esa
       ausencia: la suposición `currency || "CLP"` es la que mostraba dólares con signo de peso y sin
       decimales, y a ~950 pesos por dólar eso equivoca la cifra por casi mil veces. Si el lector la
       repusiera, el gate compararía dólares contra pesos y los llamaría coincidencia. */
    const leido = leerMonto("1.234,50 · moneda no informada");
    expect(leido?.valor).toBe(1234.5);
    expect(leido?.moneda, "la moneda ausente se rellenó con CLP").toBe(MONEDA_SIN_DECLARAR);

    // Y el efecto que importa: comparada contra una cifra en pesos, el veredicto es divergen.
    assertVeredicto(
      mismaCifra("mismo monto, monedas distintas", [
        medido("pantalla", 1234.5, MONEDA_SIN_DECLARAR, "1.234,50 · moneda no informada"),
        medido("API", 1234.5, "CLP", "1234.50"),
      ]),
      "divergen",
      "una cifra sin moneda declarada se está comparando como si fueran pesos",
    );
  });

  test("esperar a que la pantalla cargue NO es relajar la aserción", async () => {
    /* POR QUÉ EXISTE ESTA ESPERA. Varias vistas montan la tarjeta ANTES de tener el dato, en su
       rama de ausencia: en /banco, `cajaHoy(summary)` con el resumen todavía en vuelo devuelve
       `monto: null` y «Caja hoy» se pinta con `sinDato` hasta que llega. El ancla de la pantalla
       aparece antes que la cifra, así que una lectura inmediata concluye «no publica número» sobre
       algo que sí lo publica un instante después. Eso lo encontró CI, no la corrida local: el
       runner es más lento y la carrera se abrió allá. Un falso «no pude medir» manda a investigar
       lo que no está roto, y un gate que hace eso se vuelve ignorable.

       Los dos gemelos fijan las dos mitades, y la segunda es la que importa: la espera NO puede
       convertirse en una excusa para inventar una cifra. */

    // (1) La cifra llega tarde: se espera y se mide.
    let intentos = 0;
    const tardia = await conEspera(async () => {
      intentos += 1;
      return intentos < 3 ? "sin dato" : "$9.800.000";
    }, 5_000);
    expect(tardia, "la cifra que llega tarde no se esperó").toBe("$9.800.000");
    expect(leerMonto(tardia)?.valor).toBe(9_800_000);

    // (2) La cifra NUNCA llega: se devuelve el rótulo que publica la pantalla, no un número.
    const nunca = await conEspera(async () => "sin dato", 600);
    expect(nunca, "la espera fabricó una cifra donde el producto dice que no la tiene").toBe(
      "sin dato",
    );
    expect(
      leerMonto(nunca),
      'tras agotar el plazo, "sin dato" tiene que seguir siendo una ausencia',
    ).toBeNull();
  });

  test("una etiqueta con número suelto no se confunde con el monto", () => {
    // "Entra · 14 días" y su valor conviven en la misma tarjeta: el monto es el grupo más largo.
    expect(leerMonto("Entra · 14 días")?.valor).toBe(14);
    expect(leerMonto("+$24.800.000")?.valor).toBe(24_800_000);
  });
});
