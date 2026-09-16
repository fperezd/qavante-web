import { describe, expect, it } from "vitest";
import { formatClp } from "@/lib/formatters/clp";
import {
  antiguedadDe,
  certezasCsv,
  clienteMasGrave,
  clientesV04,
  coincideConsulta,
  concentracion,
  contarClientes,
  crumbGestion,
  csvClientes,
  docsVencidosPorRut,
  estimadasDe,
  explicacionBruto,
  explicacionVencido,
  filtrarClientes,
  loteRecordatorios,
  receivableIdsDeLote,
  recordatorioDe,
  tarjetasAging,
  textoCountdown,
  totalBruto,
} from "./cobrar-v04-model";
import {
  HOY,
  NOTA_ESTIMADA,
  RUT_ANDINOS,
  RUT_CORREOS,
  RUT_DIVEIMPORT,
  RUT_GPS,
  RUT_KAUFMANN,
  ar,
  arConFechasEstimadas,
  arConcentracionAlta,
  arSinClientes,
  arTodoAlDia,
  arVencidoDesconocido,
  gestionado,
} from "./cobrar-v04-fixtures";

/* V04 · Cobrar — el modelo, fijado.
 *
 * Ley 1 (Vencido y total son los del contrato, no sumas del front), Ley 2 (UN solo `bad`: el
 * cliente más grave), el "no sé" explícito (`overdue: null` jamás es 0), el bucket +61 y la
 * concentración de los TRES mayores. Cada negativo lleva su gemelo positivo con el MISMO valor. */

describe("tarjetasAging — las cinco tarjetas con % del total", () => {
  it("Vigente / 1–30 / 31–60 / +61 / Vencido con sus montos y % del total (bruto)", () => {
    const t = tarjetasAging(ar());
    expect(t.map((x) => x.key)).toEqual(["vigente", "d1_30", "d31_60", "d61_plus", "vencido"]);
    expect(t.map((x) => x.monto)).toEqual([
      14_800_000, 9_400_000, 8_900_000, 9_479_467, 27_779_467,
    ]);
    expect(t[0]!.pct).toBeCloseTo(34.76, 1);
    expect(t[3]!.pct).toBeCloseTo(22.26, 1);
    expect(t.every((x) => !x.piso)).toBe(true);
  });

  it("+61 = 61–90 + 90+ EXACTAMENTE; no arrastra el 31–60 (mutante b)", () => {
    const mas61 = tarjetasAging(ar())[3]!;
    expect(mas61.monto).toBe(5_400_000 + 4_079_467);
    // Gemelo: el mutante que suma el 31–60 daría esto, y no es lo que se publica.
    expect(mas61.monto).not.toBe(8_900_000 + 5_400_000 + 4_079_467);
  });

  it("+61 es `null` si CUALQUIERA de sus dos tramos no se conoce", () => {
    expect(tarjetasAging(ar({ aging: { ...ar().aging, d90_plus: null } }))[3]!.monto).toBeNull();
    expect(tarjetasAging(ar({ aging: { ...ar().aging, d61_90: null } }))[3]!.monto).toBeNull();
    expect(tarjetasAging(ar())[3]!.monto).not.toBeNull();
  });

  it("Ley 1: Vencido es `overdue` del contrato y su % es `overdue_pct`, no una suma del front", () => {
    // Contrato "en desacuerdo" a propósito: si el front sumara tramos, daría 27.779.467.
    const t = tarjetasAging(ar({ overdue: "27000000", overdue_pct: "63.4" }));
    expect(t[4]!.monto).toBe(27_000_000);
    expect(t[4]!.pct).toBe(63.4);
    expect(t[4]!.monto).not.toBe(27_779_467);
  });

  it("con `overdue` y sin `overdue_pct`, el % se calcula sobre el total", () => {
    const t = tarjetasAging(ar({ overdue: "21289733", overdue_pct: null }));
    expect(t[4]!.pct).toBeCloseTo(50, 1);
  });

  it("`overdue: null` (el caso VIVO) → monto y % en null, NUNCA 0 ni 0% (mutante a)", () => {
    const t = tarjetasAging(arVencidoDesconocido());
    expect(t[4]!.monto).toBeNull();
    expect(t[4]!.pct).toBeNull();
    expect(t[1]!.monto).toBeNull();
    expect(t[2]!.monto).toBeNull();
    expect(t[3]!.monto).toBeNull();
    // Gemelo positivo: el cero VERIFICADO sí es 0 y 0%.
    const alDia = tarjetasAging(arTodoAlDia());
    expect(alDia[4]!.monto).toBe(0);
    expect(alDia[4]!.pct).toBe(0);
  });

  it("Vigente con mora desconocida: un piso de $0 no informa → sin dato; un piso > 0 se dice 'al menos'", () => {
    expect(tarjetasAging(arVencidoDesconocido())[0]!.monto).toBeNull();
    const conPiso = tarjetasAging(
      arVencidoDesconocido({ aging: { ...arVencidoDesconocido().aging, current: "5000000" } }),
    );
    expect(conPiso[0]!.monto).toBe(5_000_000);
    expect(conPiso[0]!.piso).toBe(true);
    // Con la mora conocida, vigente en 0 es un cero verificado (y no un piso).
    const conocido = tarjetasAging(ar({ aging: { ...ar().aging, current: "0" } }));
    expect(conocido[0]!.monto).toBe(0);
    expect(conocido[0]!.piso).toBe(false);
  });

  it("sin respuesta → todo en null", () => {
    expect(tarjetasAging(null).every((x) => x.monto === null && x.pct === null)).toBe(true);
  });
});

describe("clientesV04 — la tabla en orden de prioridad", () => {
  const cs = clientesV04(ar(), gestionado());

  it("orden: vencido conocido de mayor a menor, luego el 'no se sabe', al final los al día", () => {
    expect(cs.map((c) => c.nombre)).toEqual([
      "Empresa de Correos de Chile",
      "Comercial Kaufmann S.A.",
      "Diveimport S.A.",
      "GPS7000",
      "Servicios Andinos Ltda",
      "Tepille SpA",
    ]);
  });

  it("en modo source preserva el orden publicado y no vuelve a priorizar clientes", () => {
    const source = clientesV04(ar(), gestionado(), {
      order: "source",
      includeDecisionSignals: false,
    });
    expect(source.map((c) => c.nombre)).toEqual((ar().top_debtors ?? []).map((c) => c.name));
    expect(source.every((c) => c.antiguedad.tono === "mut")).toBe(true);
    expect(source.every((c) => !c.sub.includes("del total"))).toBe(true);
    expect(source.every((c) => c.pctDelTotal === null)).toBe(true);
  });

  it("los días vienen del documento MÁS vencido del cliente (buckets = agrupación front)", () => {
    const gps = cs.find((c) => c.nombre === "GPS7000")!;
    /* La fixture lista el de 12 días ANTES que el de 80: "el primero" daría 12 y "el máximo" da
       80, así que este assert distingue las dos implementaciones (mutante `o` del pase §6). */
    expect(gps.dias).toBe(80);
    expect(gps.dias).not.toBe(12);
    expect(ar().overdue_documents!.filter((d) => d.client_rut === RUT_GPS)[0]!.days_overdue).toBe(
      12,
    );
    expect(gps.docsVencidos).toBe(2);
    expect(cs.find((c) => c.nombre === "Tepille SpA")!.dias).toBeNull();
  });

  it("Ley 2: UN solo `bad`, el más grave (+60 días); el otro +60 va en ámbar con sus días", () => {
    const tonos = cs.map((c) => c.antiguedad);
    expect(tonos.filter((t) => t.tono === "bad")).toHaveLength(1);
    expect(cs.find((c) => c.nombre === "GPS7000")!.antiguedad).toEqual({
      tono: "bad",
      texto: "80 días",
    });
    expect(cs.find((c) => c.nombre === "Diveimport S.A.")!.antiguedad).toEqual({
      tono: "warn",
      texto: "73 días",
    });
    // Los de 1–60 son ámbar, no rojo (mutante c).
    expect(cs.find((c) => c.nombre === "Comercial Kaufmann S.A.")!.antiguedad).toEqual({
      tono: "warn",
      texto: "34 días",
    });
  });

  it("el 'no se sabe' es gris y el cero verificado es 'Al día'", () => {
    expect(cs.find((c) => c.nombre === "Servicios Andinos Ltda")!.antiguedad).toEqual({
      tono: "mut",
      texto: "Sin vencimiento conocido",
    });
    expect(cs.find((c) => c.nombre === "Tepille SpA")!.antiguedad).toEqual({
      tono: "ok",
      texto: "Al día",
    });
  });

  it("el `.sub`: vencido + días + última gestión + concentración cuando pesa", () => {
    expect(cs.find((c) => c.nombre === "Diveimport S.A.")!.sub).toBe(
      "vencido $3.300.000 hace 73 días · gestionado 28 ago · 27,2% del total",
    );
    expect(cs.find((c) => c.nombre === "GPS7000")!.sub).toBe(
      "vencido $1.792.441 hace 80 días · sin gestión registrada",
    );
    expect(cs.find((c) => c.nombre === "Servicios Andinos Ltda")!.sub).toBe(
      "vencido: no se sabe · sin gestión registrada",
    );
    expect(cs.find((c) => c.nombre === "Tepille SpA")!.sub).toBe(
      "nada vencido · sin gestión registrada",
    );
  });

  it("sin nadie por sobre los 60 días no hay `bad` (y no hay rojo)", () => {
    const suave = ar({
      overdue_documents: ar().overdue_documents!.map((d) => ({
        ...d,
        days_overdue: Math.min(d.days_overdue, 45),
      })),
    });
    const tonos = clientesV04(suave, {}).map((c) => c.antiguedad.tono);
    expect(tonos).not.toContain("bad");
    expect(clientesV04(ar(), {}).map((c) => c.antiguedad.tono)).toContain("bad");
  });

  it("clienteMasGrave: más días gana; a igual días, más vencido; nadie sobre 60 → null", () => {
    const a = { key: "a", vencido: 100, dias: 70 };
    const b = { key: "b", vencido: 900, dias: 70 };
    const c = { key: "c", vencido: 5, dias: 90 };
    expect(clienteMasGrave([a, b])!.key).toBe("b");
    expect(clienteMasGrave([a, b, c])!.key).toBe("c");
    expect(clienteMasGrave([{ key: "d", vencido: 100, dias: 60 }])).toBeNull();
    expect(clienteMasGrave([{ key: "e", vencido: null, dias: 90 }])).toBeNull();
  });

  it("antiguedadDe: vencido > 0 sin documentos listados → ámbar 'Vencido'", () => {
    expect(antiguedadDe({ vencido: 1000, dias: null }, false)).toEqual({
      tono: "warn",
      texto: "Vencido",
    });
    expect(antiguedadDe({ vencido: 1000, dias: 1 }, false)).toEqual({
      tono: "warn",
      texto: "1 día",
    });
  });

  it("un vencido NETO negativo (NC por sobre lo vencido) es al día, no mora", () => {
    const c = clientesV04(
      ar({ top_debtors: [{ name: "X", rut: RUT_GPS, total: "100", overdue: "-50" }] }),
      {},
    )[0]!;
    expect(c.antiguedad.tono).toBe("ok");
    expect(c.sub).toContain("notas de crédito por sobre lo vencido");
  });
});

describe("concentracion — los TRES que más concentran", () => {
  it("suma EXACTAMENTE los 3 mayores por vencido; el 4º queda afuera (mutante d)", () => {
    const c = concentracion(clientesV04(ar(), {}), ar())!;
    expect(c.kind).toBe("vencido");
    expect(c.clientes.map((x) => x.nombre)).toEqual([
      "Empresa de Correos de Chile",
      "Comercial Kaufmann S.A.",
      "Diveimport S.A.",
    ]);
    expect(c.monto).toBe(4_672_594 + 4_322_373 + 3_300_000);
    // Gemelo: con el 4º (GPS7000) daría esto, y NO es lo que se publica.
    expect(c.monto).not.toBe(4_672_594 + 4_322_373 + 3_300_000 + 1_792_441);
    expect(c.pct).toBeCloseTo(44.26, 1);
  });

  it("concentración alta: 3 = $18.500.000 del vencido (92,5%), GPS7000 afuera", () => {
    const c = concentracion(clientesV04(arConcentracionAlta(), {}), arConcentracionAlta())!;
    expect(c.monto).toBe(18_500_000);
    expect(c.pct).toBeCloseTo(92.5, 1);
    expect(c.clientes.some((x) => x.nombre === "GPS7000")).toBe(false);
  });

  it("vencido DESCONOCIDO → concentra por saldo y lo dice (no se calla ni inventa mora)", () => {
    const c = concentracion(clientesV04(arVencidoDesconocido(), {}), arVencidoDesconocido())!;
    expect(c.kind).toBe("saldo");
    expect(c.monto).toBe(11_582_539 + 4_672_594 + 4_322_373);
    expect(c.pct).toBeCloseTo(48.33, 1);
    if (c.kind === "saldo") expect(c.motivo).toContain("no tiene fecha de vencimiento");
  });

  it("al día (vencido 0 verificado) → null: no se inventa urgencia; sin clientes → null", () => {
    expect(concentracion(clientesV04(arTodoAlDia(), {}), arTodoAlDia())).toBeNull();
    expect(concentracion([], arSinClientes())).toBeNull();
    expect(concentracion(clientesV04(ar(), {}), null)).toBeNull();
  });
});

describe("filtros con conteo y búsqueda", () => {
  const cs = clientesV04(ar(), gestionado());

  it("los conteos de los chips sobre toda la cartera", () => {
    expect(contarClientes(cs)).toEqual({
      prioridad: 6,
      vencido: 4,
      mas60: 2,
      sin_vencimiento: 1,
      al_dia: 1,
    });
  });

  it("filtrar: +60 días son los dos graves; al día es Tepille; sin vencimiento es Andinos", () => {
    expect(filtrarClientes(cs, "mas60").map((c) => c.nombre)).toEqual([
      "Diveimport S.A.",
      "GPS7000",
    ]);
    expect(filtrarClientes(cs, "al_dia").map((c) => c.nombre)).toEqual(["Tepille SpA"]);
    expect(filtrarClientes(cs, "sin_vencimiento").map((c) => c.nombre)).toEqual([
      "Servicios Andinos Ltda",
    ]);
    expect(filtrarClientes(cs, "prioridad")).toHaveLength(6);
  });

  it("buscar por nombre (sin mayúsculas) o por RUT con o sin puntos; los conteos siguen la búsqueda", () => {
    expect(filtrarClientes(cs, "prioridad", "gps").map((c) => c.nombre)).toEqual(["GPS7000"]);
    expect(filtrarClientes(cs, "prioridad", "76.111.111").map((c) => c.nombre)).toEqual([
      "Diveimport S.A.",
    ]);
    expect(filtrarClientes(cs, "prioridad", "761111111")).toHaveLength(1);
    expect(contarClientes(cs, "kaufmann")).toEqual({
      prioridad: 1,
      vencido: 1,
      mas60: 0,
      sin_vencimiento: 0,
      al_dia: 0,
    });
    expect(coincideConsulta({ nombre: "X", rut: null }, "76")).toBe(false);
    expect(coincideConsulta({ nombre: "X", rut: null }, "")).toBe(true);
  });

  it("el caso vivo: todos en 'sin vencimiento conocido', ninguno vencido ni al día", () => {
    expect(contarClientes(clientesV04(arVencidoDesconocido(), {}))).toEqual({
      prioridad: 5,
      vencido: 0,
      mas60: 0,
      sin_vencimiento: 5,
      al_dia: 0,
    });
  });
});

describe("crumbGestion — chip gris, nunca celebración", () => {
  it("2 de 6 gestionados, última hace 2 días", () => {
    const c = crumbGestion(clientesV04(ar(), gestionado()), HOY);
    expect(c.chip).toBe("Gestionaste a 2 de 6 clientes · última hace 2 días");
    expect(c.gestionados).toBe(2);
    expect(c.ultima).toBe("2026-08-28");
  });

  it("sin gestiones → lo dice; todos gestionados → 'los N clientes'", () => {
    expect(crumbGestion(clientesV04(ar(), {}), HOY).chip).toBe("Sin gestiones registradas");
    const todos = clientesV04(
      arTodoAlDia(),
      gestionado({ [RUT_DIVEIMPORT.replace(/\./g, "")]: "2026-08-30" }),
    );
    const c = crumbGestion(
      todos.map((x) => ({ ...x, ultimaGestion: x.ultimaGestion ?? "2026-08-29" })),
      HOY,
    );
    expect(c.chip).toMatch(/^Gestionaste a los 2 clientes · última /);
  });
});

describe("footer — por cobrar (bruto)", () => {
  it("es `total` del contrato, NO la suma de los saldos del top (mutante e)", () => {
    expect(totalBruto(ar())).toBe(42_579_467);
    const sumaTop = ar().top_debtors!.reduce((s, d) => s + Number(d.total), 0);
    expect(sumaTop).toBe(24_399_988);
    expect(totalBruto(ar())).not.toBe(sumaTop);
    expect(totalBruto(null)).toBe(0);
  });

  /* El ⓘ existe para explicar EL número: si se equivoca ahí, es peor que no estar. La versión
     anterior decía "Es el mismo número que 'Te deben' en Hoy" y es FALSO — en V01 la cifra grande
     de "Te deben" es el VENCIDO (`indicadoresHoy`: `valor: formatClp(vencido)`), y este total
     aparece sólo en su detalle. Mismo registro, distinto número. */
  it("el ⓘ NO dice que el bruto sea el número de 'Te deben': dice de dónde sale y en qué difiere", () => {
    const e = explicacionBruto(ar(), HOY);
    expect(e.definicion).toContain("Sale del mismo registro que “Te deben” en Hoy");
    expect(e.definicion).toContain("no es el mismo número");
    expect(e.definicion).toContain("allá la cifra grande es lo VENCIDO");
    // El negativo, con su gemelo positivo sobre la MISMA frase: la afirmación falsa no vuelve.
    expect(e.definicion).not.toContain("Es el mismo número que “Te deben”");
    expect("Es el mismo número que “Te deben” en Hoy.").toContain(
      "Es el mismo número que “Te deben”",
    );
  });

  it("el ⓘ: definición, incluye/excluye, fuente y frescura; los sin fecha aparecen si existen", () => {
    const e = explicacionBruto(ar(), HOY);
    expect(e.definicion).toContain("bruto");
    expect(e.excluye.some((x) => x.includes("cedidas por factoring"))).toBe(true);
    expect(e.excluye.some((x) => x.includes("sin fecha de vencimiento"))).toBe(false);
    expect(e.fuente).toContain("Registro de cuentas por cobrar disponible en Qavante");
    expect(e.fuente).not.toContain("/api/");
    expect(e.frescura).toContain("30 ago 2026");
    const sinFecha = explicacionBruto(arVencidoDesconocido(), HOY);
    expect(sinFecha.excluye.some((x) => x.includes(formatClp(42_579_467)))).toBe(true);
  });
});

describe("recordatorios — las plantillas actuales de Cobrar v2", () => {
  const cs = clientesV04(ar(), {});

  it("conserva los UUIDs que entrega el contrato; no reconstruye identidad desde datos visibles", () => {
    const dive = cs.find((c) => c.nombre === "Diveimport S.A.")!;
    expect(dive.receivableIds).toEqual(["00000000-0000-4000-8000-000000000001"]);
    const sinIds = clientesV04(
      ar({
        top_debtors: [{ name: "Mismo nombre", rut: RUT_DIVEIMPORT, total: "1", overdue: "1" }],
      }),
      {},
    )[0]!;
    expect(sinIds.receivableIds).toEqual([]);
  });

  it("con vencido conocido va en modo urgencia y nombra el monto vencido", () => {
    const r = recordatorioDe(cs.find((c) => c.nombre === "Diveimport S.A.")!);
    expect(r.texto).toContain("Estimados Diveimport S.A.:");
    expect(r.texto).toContain("documentos vencidos");
    expect(r.texto).toContain("$3.300.000");
    expect(r.waHref).toBe(`https://wa.me/?text=${encodeURIComponent(r.texto)}`);
    expect(r.mailtoHref.startsWith("mailto:?subject=Cobranza%20pendiente&body=")).toBe(true);
  });

  it("sin vencido conocido NO se le afirma una mora al cliente (modo concentración)", () => {
    const r = recordatorioDe(cs.find((c) => c.nombre === "Servicios Andinos Ltda")!);
    expect(r.texto).not.toContain("vencidos");
    expect(r.texto).toContain("documentos pendientes");
    expect(r.texto).toContain("$980.000");
  });

  it("el lote: una plantilla por cliente, en el orden del banner", () => {
    const conc = concentracion(cs, ar())!;
    const lote = loteRecordatorios(conc.clientes);
    expect(lote.map((r) => r.nombre)).toEqual(conc.clientes.map((c) => c.nombre));
    expect(lote).toHaveLength(3);
  });

  it("el texto de la cuenta regresiva dice qué va a pasar y en cuánto", () => {
    expect(textoCountdown(5, 3)).toBe("Enviando 3 recordatorios en 5 s");
    expect(textoCountdown(1, 1)).toBe("Enviando un recordatorio en 1 s");
  });

  it("el lote manda sólo UUIDs del contrato, sin duplicarlos ni inventarlos", () => {
    const conc = concentracion(cs, ar())!;
    const ids = receivableIdsDeLote(conc.clientes);
    expect(ids).toEqual([
      "00000000-0000-4000-8000-000000000003",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000001",
    ]);
    // Gemelo positivo: un ID duplicado sí se conserva una vez, no se reemplaza por RUT/nombre.
    expect(
      receivableIdsDeLote([{ ...conc.clientes[0]!, receivableIds: [ids[0]!, ids[0]!] }]),
    ).toEqual([ids[0]]);
  });
});

describe("csvClientes — exportar", () => {
  it("cabecera + una fila por cliente, montos crudos y el 'no se sabe' explícito", () => {
    const csv = csvClientes(clientesV04(ar(), gestionado()));
    const lineas = csv.split("\n");
    expect(lineas[0]).toBe(
      "cliente;rut;saldo;vencido;dias_vencido;antiguedad;ultima_gestion;fechas_no_confirmadas",
    );
    expect(lineas[3]).toBe(
      `Diveimport S.A.;${RUT_DIVEIMPORT};11582539;3300000;73;73 días;2026-08-28;`,
    );
    expect(lineas[5]).toBe(
      `Servicios Andinos Ltda;${RUT_ANDINOS};980000;sin dato;;Sin vencimiento conocido;;`,
    );
    expect(lineas[2]).toContain(`${RUT_KAUFMANN};4322373;4322373;34;34 días;2026-08-21;`);
  });

  it("exporta los documentos con fecha no confirmada por cliente; la nota no viaja al CSV", () => {
    const csv = csvClientes(clientesV04(arConFechasEstimadas(), gestionado()));
    expect(csv).toContain(
      `Diveimport S.A.;${RUT_DIVEIMPORT};11582539;3300000;73;73 días;2026-08-28;Factura 462: estimada`,
    );
    expect(csv).toContain("Factura 495: sin confirmar");
    expect(csv).not.toContain(NOTA_ESTIMADA);
  });
});

describe("certeza de la fecha — server-owned, nunca inferida (contrato #558)", () => {
  const cs = () => clientesV04(arConFechasEstimadas(), gestionado());
  const cliente = (nombre: string) => cs().find((c) => c.nombre === nombre)!;

  it("lista por cliente los documentos estimados/sin confirmar con la certeza y la nota tal cual", () => {
    expect(cliente("Diveimport S.A.").certezas).toEqual([
      { documento: "Factura 462", certeza: "estimated", nota: NOTA_ESTIMADA },
    ]);
    // Nota vacía → null: la pill sola dice el estado, no se inventa un texto.
    expect(cliente("Empresa de Correos de Chile").certezas).toEqual([
      { documento: "Factura 495", certeza: "unconfirmed", nota: null },
    ]);
    // Gemelo: con todos confirmados, nada que listar.
    expect(cliente("GPS7000").certezas).toEqual([]);
    expect(clientesV04(ar(), gestionado()).every((c) => c.certezas.length === 0)).toBe(true);
    expect(certezasCsv(cliente("Diveimport S.A."))).toBe("Factura 462: estimada");
  });

  it("un documento ESTIMADO no mueve los días de mora ni el rojo, aunque esté 'más vencido'", () => {
    // Diveimport: el estimado dice 90 días, el confirmado 73. Los días son los del confirmado.
    expect(cliente("Diveimport S.A.").dias).toBe(73);
    expect(cliente("Diveimport S.A.").dias).not.toBe(90);
    expect(cliente("Diveimport S.A.").docsVencidos).toBe(2); // listado igual: son documentos del registro
    // Gemelo positivo: el MISMO documento, confirmado, sí fija 90 días.
    const confirmado = arConFechasEstimadas({
      overdue_documents: arConFechasEstimadas().overdue_documents!.map((d) =>
        d.document === "Factura 462" ? { ...d, due_date_certainty: "confirmed" as const } : d,
      ),
    });
    expect(
      clientesV04(confirmado, gestionado()).find((c) => c.nombre === "Diveimport S.A.")!.dias,
    ).toBe(90);
    // Ley 2: el único rojo sigue siendo GPS7000 (80 días confirmados), no Diveimport con 90 estimados.
    const grave = clienteMasGrave(cs());
    expect(grave?.nombre).toBe("GPS7000");
    expect(cliente("Diveimport S.A.").antiguedad).toEqual({ tono: "warn", texto: "73 días" });
    // Correos: el sin confirmar (5 días) tampoco toca sus 21 días confirmados.
    expect(cliente("Empresa de Correos de Chile").dias).toBe(21);
  });

  it("un documento SIN el campo no se asume confirmado: no alimenta la mora y se declara", () => {
    const sinCampo = {
      ...ar().overdue_documents![0]!,
      client_rut: RUT_CORREOS,
      document: "Factura 900",
      days_overdue: 200,
      due_date_certainty: undefined,
    } as unknown as NonNullable<ReturnType<typeof ar>["overdue_documents"]>[number];
    const docs = docsVencidosPorRut([sinCampo]);
    const correos = docs.get([...docs.keys()][0]!)!;
    expect(correos.maxDias).toBeNull();
    expect(correos.certezas).toEqual([
      { documento: "Factura 900", certeza: "no_informada", nota: null },
    ]);
    // Gemelo: confirmado, el mismo documento fija los 200 días.
    const conCampo = docsVencidosPorRut([{ ...sinCampo, due_date_certainty: "confirmed" }]);
    expect(conCampo.get([...conCampo.keys()][0]!)!.maxDias).toBe(200);
  });

  it("estimated_due_date_count es del servidor: se publica tal cual; sin el campo es null, no 0", () => {
    expect(estimadasDe(arConFechasEstimadas())).toBe(1);
    expect(estimadasDe(ar())).toBe(0);
    expect(estimadasDe(ar({ estimated_due_date_count: undefined as never }))).toBeNull();
    expect(estimadasDe(null)).toBeNull();
    // No se recuenta desde los documentos: el servidor manda 4 aunque la página liste 1.
    expect(estimadasDe(arConFechasEstimadas({ estimated_due_date_count: 4 }))).toBe(4);
  });

  it("el ⓘ de Vencido · bruto declara que lo estimado no es mora, con el conteo del servidor", () => {
    const con = explicacionVencido(arConFechasEstimadas(), HOY);
    expect(con.excluye).toContain(
      "Documentos con fecha estimada: sirven para ordenar, pero el registro no los cuenta como mora",
    );
    expect(con.excluye).toContain("Hoy: 1 documento con fecha estimada según el registro");
    expect(explicacionVencido(ar(), HOY).excluye.some((x) => x.startsWith("Hoy:"))).toBe(false);
  });
});
