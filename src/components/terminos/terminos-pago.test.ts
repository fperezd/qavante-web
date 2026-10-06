import { describe, it, expect } from "vitest";
import {
  parseSiiDate,
  addDays,
  daysBetween,
  estadoDoc,
  readTerminos,
  termFor,
  isTermCustom,
  withTerm,
  withoutTerm,
  withDefaultTerm,
  buildMaestro,
  identidadContraparte,
  totalesMaestro,
  readPagados,
  isPagado,
  declaradoPagadoEl,
  TERMINO_DEFAULT,
  TERMINOS_KEY,
  PAGADOS_KEY,
  type DocConVencimiento,
} from "./terminos-pago";

// Hoy fijo para tests deterministas: 2026-07-20.
const HOY = new Date(2026, 6, 20);

describe("parseSiiDate", () => {
  it("DD/MM/YYYY (formato RCV)", () => {
    const d = parseSiiDate("24/06/2026")!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 5, 24]);
  });
  it("ISO YYYY-MM-DD (ignora hora)", () => {
    const d = parseSiiDate("2026-06-24T00:00:00Z")!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 5, 24]);
  });
  it("inválida / vacía → null", () => {
    expect(parseSiiDate("31/02/2026")).toBeNull(); // 31 de feb no existe
    expect(parseSiiDate("")).toBeNull();
    expect(parseSiiDate(null)).toBeNull();
    expect(parseSiiDate("nope")).toBeNull();
  });
});

describe("addDays / daysBetween", () => {
  it("suma calendario y cruza mes", () => {
    const d = addDays(new Date(2026, 5, 24), 30); // 24 jun + 30 = 24 jul
    expect([d.getMonth(), d.getDate()]).toEqual([6, 24]);
  });
  it("daysBetween firmado", () => {
    expect(daysBetween(new Date(2026, 6, 20), new Date(2026, 6, 25))).toBe(5);
    expect(daysBetween(new Date(2026, 6, 25), new Date(2026, 6, 20))).toBe(-5);
  });
});

describe("estadoDoc", () => {
  it("vencido / por_vencer / vigente / sin_fecha", () => {
    expect(estadoDoc(new Date(2026, 6, 10), HOY)).toBe("vencido"); // 10 jul < hoy
    expect(estadoDoc(new Date(2026, 6, 25), HOY)).toBe("por_vencer"); // en 5 días
    expect(estadoDoc(new Date(2026, 7, 30), HOY)).toBe("vigente"); // lejos
    expect(estadoDoc(null, HOY)).toBe("sin_fecha");
  });
});

describe("prefs de términos", () => {
  it("readTerminos rellena defaults (30/30/5) y descarta basura", () => {
    const t = readTerminos(undefined);
    expect(t.ventas.default).toBe(30);
    expect(t.compras.default).toBe(30);
    expect(t.honorarios.default).toBe(5);
    expect(t.ventas.byRut).toEqual({});
    // basura → ignora, mantiene default
    const t2 = readTerminos({ [TERMINOS_KEY]: { ventas: { default: "nope", byRut: ["x"] } } });
    expect(t2.ventas.default).toBe(30);
  });

  it("termFor: override por rut gana al default; normaliza el rut", () => {
    const blob = withTerm(undefined, "ventas", "96.572.360-9", 45);
    const t = readTerminos(blob);
    expect(termFor(t, "ventas", "96572360-9")).toBe(45);
    expect(termFor(t, "ventas", "96.572.360-9")).toBe(45); // mismo rut, otro formato
    expect(termFor(t, "ventas", "otro-rut")).toBe(30); // sin override → default
    expect(isTermCustom(t, "ventas", "96572360-9")).toBe(true);
    expect(isTermCustom(t, "ventas", "otro")).toBe(false);
  });

  it("withoutTerm vuelve al default; withDefaultTerm cambia el default del tipo", () => {
    const marked = withTerm(undefined, "compras", "77111222-3", 60);
    const undone = withoutTerm(marked, "compras", "77111222-3");
    expect(termFor(readTerminos(undone), "compras", "77111222-3")).toBe(30);

    const changed = withDefaultTerm(undefined, "honorarios", 10);
    expect(readTerminos(changed).honorarios.default).toBe(10);
    expect(readTerminos(changed).ventas.default).toBe(30); // no toca los otros
  });

  it("with* preservan el resto del blob (reemplaza, no mergea → superset)", () => {
    const blob = { otra_pref: "x", ...withTerm(undefined, "ventas", "1-9", 15) };
    const next = withTerm(blob, "ventas", "2-7", 20);
    expect(next.otra_pref).toBe("x");
    const t = readTerminos(next);
    expect(termFor(t, "ventas", "1-9")).toBe(15);
    expect(termFor(t, "ventas", "2-7")).toBe(20);
  });
});

describe("declaraciones heredadas (prefs, solo lectura)", () => {
  // Blob tal como lo dejó el botón viejo "Marcar conciliado": `tipo:rut:folio → fecha del clic`.
  const blob = { [PAGADOS_KEY]: { "compras:77111222-3:1002": "2026-07-20" } };

  it("readPagados es defensivo y las marcas se siguen leyendo", () => {
    expect(readPagados(undefined)).toEqual({});
    expect(readPagados({ [PAGADOS_KEY]: "nope" })).toEqual({});
    const map = readPagados(blob);
    // El RUT se normaliza al leer: con puntos o sin puntos es la misma marca.
    expect(isPagado(map, "compras", "77.111.222-3", 1002)).toBe(true);
    expect(declaradoPagadoEl(map, "compras", "77.111.222-3", 1002)).toBe("2026-07-20");
    // Distinto folio / distinto tipo → no hay marca.
    expect(isPagado(map, "compras", "77111222-3", 9999)).toBe(false);
    expect(isPagado(map, "ventas", "77111222-3", 1002)).toBe(false);
    expect(declaradoPagadoEl(map, "ventas", "77111222-3", 1002)).toBeNull();
  });

  it("ya no existe forma de ESCRIBIR una marca nueva desde el motor puro", async () => {
    // Control negativo del requisito 3: si alguien reintroduce un `withPagado`, este test cae.
    const mod = (await import("./terminos-pago")) as Record<string, unknown>;
    expect(Object.keys(mod).filter((k) => /^with(out)?Pagado$/.test(k))).toEqual([]);
  });
});

describe("buildMaestro", () => {
  const docs: DocConVencimiento[] = [
    // Kaufmann: 2 facturas. Con término 30 desde emisión:
    {
      rut: "96572360-9",
      name: "COMERCIAL KAUFMANN S.A.",
      fecha: "01/06/2026",
      monto: 5_000_000,
      folio: 1,
    }, // vence 01/07 → VENCIDO
    {
      rut: "96572360-9",
      name: "COMERCIAL KAUFMANN S.A.",
      fecha: "01/07/2026",
      monto: 3_000_000,
      folio: 2,
    }, // vence 31/07 → vigente
    // Diveimport: 1 factura reciente, término 30.
    { rut: "55555555-5", name: "DIVEIMPORT S.A.", fecha: "18/07/2026", monto: 1_000_000, folio: 3 }, // vence 17/08 → vigente
  ];

  it("agrega por contraparte, deriva vencimiento y clasifica estado", () => {
    const t = readTerminos(undefined); // ventas default 30
    const m = buildMaestro(docs, t, "ventas", HOY);
    const kauf = m.find((c) => c.rut === "96572360-9")!;
    expect(kauf.docCount).toBe(2);
    expect(kauf.total).toBe(8_000_000);
    expect(kauf.vencido).toBe(5_000_000); // solo la del 01/06
    expect(kauf.termino).toBe(30);
    // próximo vencimiento no vencido = 31/07 (la factura 2)
    expect(kauf.proximoVencimiento).not.toBeNull();
    expect(kauf.proximoVencimiento!.getMonth()).toBe(6); // julio
  });

  it("una factura RECLAMADA no suma al total ni al vencido, pero sí aparece en el detalle con su marca", () => {
    const conReclamada: DocConVencimiento[] = [
      ...docs,
      {
        rut: "96572360-9",
        name: "COMERCIAL KAUFMANN S.A.",
        fecha: "01/06/2026",
        monto: 4_000_000,
        folio: 9,
        reclamado: true,
      }, // vencida, pero RECLAMADA → no suma $ (decisión de Fernando 2026-08-01)
    ];
    const kauf = buildMaestro(conReclamada, readTerminos(undefined), "ventas", HOY).find(
      (c) => c.rut === "96572360-9",
    )!;
    expect(kauf.total).toBe(8_000_000); // las 2 no reclamadas; la reclamada de 4M NO suma
    expect(kauf.vencido).toBe(5_000_000); // solo la del 01/06 no reclamada
    const recl = kauf.docs.find((d) => d.folio === 9)!;
    expect(recl.reclamado).toBe(true); // pero sigue en el detalle, marcada con su "R"
  });

  it("una factura CEDIDA (factoring, RPETC) no es por-cobrar, pero aparece en el detalle marcada", () => {
    const conCedida: DocConVencimiento[] = [
      ...docs,
      {
        rut: "96572360-9",
        name: "COMERCIAL KAUFMANN S.A.",
        fecha: "01/06/2026",
        monto: 4_000_000,
        folio: 11,
        cedido: true,
      }, // vencida, pero CEDIDA → la cobra el factor, no la empresa → no suma al por-cobrar (#804)
    ];
    const kauf = buildMaestro(conCedida, readTerminos(undefined), "ventas", HOY).find(
      (c) => c.rut === "96572360-9",
    )!;
    expect(kauf.total).toBe(8_000_000); // la cedida de 4M NO suma
    expect(kauf.vencido).toBe(5_000_000);
    const ced = kauf.docs.find((d) => d.folio === 11)!;
    expect(ced.cedido).toBe(true); // sigue en el detalle, marcada como cedida
  });

  it("ordena los documentos de más nuevo a más antiguo (por emisión)", () => {
    const m = buildMaestro(docs, readTerminos(undefined), "ventas", HOY);
    const kauf = m.find((c) => c.rut === "96572360-9")!;
    expect(kauf.docs[0]!.folio).toBe(2); // 01/07 (más nuevo)
    expect(kauf.docs[1]!.folio).toBe(1); // 01/06
  });

  it("ordena contrapartes por vencido desc (a quién perseguir primero)", () => {
    const t = readTerminos(undefined);
    const m = buildMaestro(docs, t, "ventas", HOY);
    expect(m[0]!.rut).toBe("96572360-9"); // Kaufmann tiene vencido; Diveimport no
  });

  it("el override de término mueve el vencimiento (término más largo → deja de estar vencido)", () => {
    // Con término 90 para Kaufmann, la factura del 01/06 vence 30/08 → ya no vencida.
    const blob = withTerm(undefined, "ventas", "96572360-9", 90);
    const m = buildMaestro(docs, readTerminos(blob), "ventas", HOY);
    const kauf = m.find((c) => c.rut === "96572360-9")!;
    expect(kauf.vencido).toBe(0);
    expect(kauf.terminoCustom).toBe(true);
  });

  it("una Nota de Crédito resta del total pero no de un vencimiento sin vínculo confirmado", () => {
    const conNC: DocConVencimiento[] = [
      {
        rut: "96572360-9",
        name: "K",
        fecha: "01/06/2026",
        monto: 5_000_000,
        folio: 1,
        tipoDoc: 33,
      }, // factura vencida
      {
        rut: "96572360-9",
        name: "K",
        fecha: "05/06/2026",
        monto: 2_000_000,
        folio: 2,
        tipoDoc: 61,
      }, // NC vencida
    ];
    const k = buildMaestro(conNC, readTerminos(undefined), "ventas", HOY)[0]!;
    expect(k.total).toBe(3_000_000); // 5M − 2M
    expect(k.vencido).toBe(5_000_000); // el crédito no se asigna a esta factura por heurística
    const nc = k.docs.find((d) => d.folio === 2)!;
    expect(nc.esNotaCredito).toBe(true);
    expect(nc.monto).toBe(-2_000_000); // firmado negativo
    expect(nc.associationStatus).toBe("unresolved");
  });

  it("la NC sin referencia no se reparte arbitrariamente al vencido (caso TD Synnex)", () => {
    const conNC: DocConVencimiento[] = [
      // factura vieja VENCIDA (18/03 + 30 = 17/04 < hoy)
      {
        rut: "77915170-0",
        name: "TD",
        fecha: "18/03/2026",
        monto: 5_663_148,
        folio: 26015,
        tipoDoc: 33,
      },
      // NC reciente ("por vencer" por su fecha) que acredita la vieja
      {
        rut: "77915170-0",
        name: "TD",
        fecha: "23/06/2026",
        monto: 4_000_000,
        folio: 3241,
        tipoDoc: 61,
      },
    ];
    const k = buildMaestro(conNC, readTerminos(undefined), "compras", HOY)[0]!;
    expect(k.total).toBe(1_663_148); // 5.663.148 − 4.000.000
    expect(k.vencido).toBe(5_663_148); // queda bruto hasta resolver a qué documento aplica la NC
    expect(k.porVencer).toBe(0);
    expect(k.docs.find((d) => d.folio === 3241)?.associationStatus).toBe("unresolved");
  });

  it("una referencia legacy sin CodRef no anula ni cambia el vencimiento", () => {
    const conRef: DocConVencimiento[] = [
      { rut: "1-9", name: "X", fecha: "01/06/2026", monto: 5_000_000, folio: 100, tipoDoc: 33 },
      {
        rut: "1-9",
        name: "X",
        fecha: "10/06/2026",
        monto: 5_000_000,
        folio: 200,
        tipoDoc: 61,
        refFolio: 100,
        refTipoDoc: 33,
      },
    ];
    const k = buildMaestro(conRef, readTerminos(undefined), "compras", HOY)[0]!;
    expect(k.total).toBe(0); // 5M − 5M
    expect(k.vencido).toBe(5_000_000);
    expect(k.docs[0]!.folio).toBe(100);
    expect(k.docs[0]!.esNotaCredito).toBe(false);
    expect(k.docs[0]!.anulacion).toBeNull();
    expect(k.docs[1]!.folio).toBe(200);
    expect(k.docs[1]!.esNotaCredito).toBe(true);
    expect(k.docs[1]!.refFolio).toBeNull();
    expect(k.docs[1]!.associationStatus).toBe("reference_effect_unknown");
  });

  it("una referencia legacy sobre-acreditada tampoco redistribuye saldos", () => {
    // #1 vencida $5M; #2 vigente $2M con una NC de $3M que la referencia (sobre-crédito de $1M).
    const docs: DocConVencimiento[] = [
      { rut: "1-9", name: "X", fecha: "01/06/2026", monto: 5_000_000, folio: 1, tipoDoc: 33 },
      { rut: "1-9", name: "X", fecha: "15/07/2026", monto: 2_000_000, folio: 2, tipoDoc: 33 },
      {
        rut: "1-9",
        name: "X",
        fecha: "16/07/2026",
        monto: 3_000_000,
        folio: 3,
        tipoDoc: 61,
        refFolio: 2,
        refTipoDoc: 33,
      },
    ];
    const k = buildMaestro(docs, readTerminos(undefined), "compras", HOY)[0]!;
    expect(k.total).toBe(4_000_000); // 5M + 2M − 3M
    expect(k.vencido).toBe(5_000_000);
    expect(k.docs.find((d) => d.folio === 2)?.anulacion).toBeNull();
    expect(k.docs.find((d) => d.folio === 3)?.associationStatus).toBe("reference_effect_unknown");
  });

  it("propaga `reclamado` del RCV al DocMaestro (para pintar la R)", () => {
    const docs: DocConVencimiento[] = [
      {
        rut: "1-9",
        name: "X",
        fecha: "01/06/2026",
        monto: 0,
        folio: 500,
        tipoDoc: 33,
        reclamado: true,
      },
      { rut: "1-9", name: "X", fecha: "02/06/2026", monto: 1_000_000, folio: 501, tipoDoc: 33 },
    ];
    const k = buildMaestro(docs, readTerminos(undefined), "compras", HOY)[0]!;
    expect(k.docs.find((d) => d.folio === 500)!.reclamado).toBe(true);
    expect(k.docs.find((d) => d.folio === 501)!.reclamado).toBe(false);
  });

  it("una factura futura con referencia legacy sigue visible como próximo vencimiento", () => {
    const conRef: DocConVencimiento[] = [
      { rut: "1-9", name: "X", fecha: "18/07/2026", monto: 1_000_000, folio: 300, tipoDoc: 33 },
      {
        rut: "1-9",
        name: "X",
        fecha: "18/07/2026",
        monto: 1_000_000,
        folio: 301,
        tipoDoc: 61,
        refFolio: 300,
        refTipoDoc: 33,
      },
    ];
    const k = buildMaestro(conRef, readTerminos(undefined), "compras", HOY)[0]!;
    expect(k.total).toBe(0);
    expect(k.docs.find((d) => d.folio === 300)!.anulacion).toBeNull();
    expect(k.docs.find((d) => d.folio === 301)!.associationStatus).toBe("reference_effect_unknown");
    expect(k.proximoVencimiento?.toISOString().slice(0, 10)).toBe("2026-08-17");
  });

  it("la NC neta aunque el SII la mande positiva o negativa (por magnitud)", () => {
    const neg: DocConVencimiento[] = [
      { rut: "1-9", name: "X", fecha: "01/06/2026", monto: -2_000_000, folio: 9, tipoDoc: 61 },
    ];
    const k = buildMaestro(neg, readTerminos(undefined), "ventas", HOY)[0]!;
    expect(k.docs[0]!.monto).toBe(-2_000_000); // magnitud 2M con signo NC
    expect(k.total).toBe(-2_000_000);
  });

  it("totalesMaestro suma el conjunto", () => {
    const t = readTerminos(undefined);
    const tot = totalesMaestro(buildMaestro(docs, t, "ventas", HOY));
    expect(tot.total).toBe(9_000_000);
    expect(tot.vencido).toBe(5_000_000);
    expect(tot.contrapartes).toBe(2);
    expect(tot.docs).toBe(3);
  });

  it("SIN motor (callers legacy): una marca manual sigue saliendo del vencido", () => {
    const t = readTerminos(undefined);
    // Marca vieja sobre la factura vencida de Kaufmann (folio 1).
    const pagados = readPagados({ [PAGADOS_KEY]: { "ventas:96572360-9:1": "2026-07-20" } });
    const m = buildMaestro(docs, t, "ventas", HOY, pagados);
    const kauf = m.find((c) => c.rut === "96572360-9")!;
    expect(kauf.vencido).toBe(0); // la única vencida quedó pagada
    expect(kauf.pagado).toBe(5_000_000);
    expect(kauf.total).toBe(8_000_000); // el total no cambia
    const docPagada = kauf.docs.find((d) => d.folio === 1)!;
    expect(docPagada.pagado).toBe(true);
  });

  it("default por tipo: honorarios usa 5 días", () => {
    expect(TERMINO_DEFAULT.honorarios).toBe(5);
    const bhe: DocConVencimiento[] = [
      { rut: "12345678-9", name: "Juan Prof", fecha: "18/07/2026", monto: 500_000, folio: 9 }, // +5 = 23/07 → por_vencer
    ];
    const m = buildMaestro(bhe, readTerminos(undefined), "honorarios", HOY);
    expect(m[0]!.docs[0]!.estado).toBe("por_vencer");
  });
});

/* ═══ D08/T03: UN CENTINELA NO ES UNA IDENTIDAD ═══════════════════════════════
 * El SII manda `55.555.555-5` para TODA contraparte extranjera. Ese número pasa el módulo 11,
 * así que entraba a `buildMaestro` como un RUT normal: una sola fila con los montos sumados y
 * el PRIMER nombre recorrido. El inventario de abajo es el medido en la base de producción de
 * Tooxs el 2026-10-06: 14 documentos de compra de 9 proveedores extranjeros, $650.360 en total,
 * de los cuales HETZNER aporta $10.340 (1,6%). Fundidos, la fila de HETZNER decía $650.360. */

/** Los 9 proveedores extranjeros de Tooxs y sus 14 facturas, todos bajo el centinela. */
const COMPRAS_EXTRANJERAS: ReadonlyArray<readonly [string, number, number]> = [
  // [razón social, folio, monto]
  ["ANTHROPIC, PBC", 101, 100_000],
  ["ANTHROPIC, PBC", 102, 91_251],
  ["MICROSOFT CORPORATION", 103, 100_000],
  ["MICROSOFT CORPORATION", 104, 89_641],
  ["GITHUB, INC.", 105, 60_000],
  ["GITHUB, INC.", 106, 50_383],
  ["FLY.IO, INC.", 107, 34_850],
  ["FLY.IO, INC.", 108, 30_000],
  ["HUBSPOT INC.", 109, 18_067],
  ["HUBSPOT INC.", 110, 10_000],
  ["GOOGLE LLC", 111, 25_633],
  ["GAMMA", 112, 18_723],
  ["NEON, LLC", 113, 11_472],
  ["HETZNER ONLINE GMBH", 114, 10_340],
];

/** Totales por proveedor, tal como se midieron en producción. */
const ESPERADO_POR_PROVEEDOR: Record<string, number> = {
  "ANTHROPIC, PBC": 191_251,
  "MICROSOFT CORPORATION": 189_641,
  "GITHUB, INC.": 110_383,
  "FLY.IO, INC.": 64_850,
  "HUBSPOT INC.": 28_067,
  "GOOGLE LLC": 25_633,
  GAMMA: 18_723,
  "NEON, LLC": 11_472,
  "HETZNER ONLINE GMBH": 10_340,
};

const TOTAL_GRUPO_FUNDIDO = 650_360;

const docsExtranjeros = (): DocConVencimiento[] =>
  COMPRAS_EXTRANJERAS.map(([name, folio, monto]) => ({
    rut: "55555555-5",
    name,
    fecha: "01/06/2026",
    monto,
    folio,
    tipoDoc: 33,
  }));

describe("identidadContraparte", () => {
  it("con RUT real, la clave ES el RUT normalizado y el RUT se publica", () => {
    expect(identidadContraparte("96.572.360-9", "COMERCIAL KAUFMANN S.A.")).toEqual({
      key: "96572360-9",
      rut: "96572360-9",
    });
  });

  it("con identidad débil, la clave es el nombre y el RUT queda en null", () => {
    expect(identidadContraparte("55555555-5", "HETZNER ONLINE GMBH")).toEqual({
      key: "sin-rut:HETZNER ONLINE GMBH",
      rut: null,
    });
    expect(identidadContraparte("SIN-RUT", "GAMMA")).toEqual({
      key: "sin-rut:GAMMA",
      rut: null,
    });
    expect(identidadContraparte("S/D", "")).toEqual({
      key: "sin-rut:sin-identificar",
      rut: null,
    });
    expect(identidadContraparte(null, null)).toEqual({
      key: "sin-rut:sin-identificar",
      rut: null,
    });
  });
});

describe("buildMaestro: el centinela de extranjero no funde contrapartes", () => {
  const terminos = readTerminos(undefined);

  it("los 9 proveedores de Tooxs quedan en 9 filas, y la suma cuadra con el grupo fundido", () => {
    const cps = buildMaestro(docsExtranjeros(), terminos, "compras", HOY);
    expect(cps).toHaveLength(9);
    const porNombre = new Map(cps.map((cp) => [cp.name, cp]));
    for (const [nombre, esperado] of Object.entries(ESPERADO_POR_PROVEEDOR)) {
      expect(porNombre.get(nombre)?.total, nombre).toBe(esperado);
    }
    // LA SUMA: desagregar no crea ni pierde un peso.
    expect(cps.reduce((s, cp) => s + cp.total, 0)).toBe(TOTAL_GRUPO_FUNDIDO);
  });

  it("HETZNER debe $10.340, no los $650.360 del grupo completo", () => {
    const cps = buildMaestro(docsExtranjeros(), terminos, "compras", HOY);
    const hetzner = cps.find((cp) => cp.name === "HETZNER ONLINE GMBH");
    expect(hetzner?.total).toBe(10_340);
    expect(hetzner?.total).not.toBe(TOTAL_GRUPO_FUNDIDO);
    expect(hetzner?.docCount).toBe(1);
  });

  it("ninguna fila extranjera reclama el centinela como RUT; se nombra por su razón social", () => {
    const cps = buildMaestro(docsExtranjeros(), terminos, "compras", HOY);
    for (const cp of cps) {
      expect(cp.rut).toBeNull();
      expect(cp.key).toBe(`sin-rut:${cp.name}`);
      // El RUT del DOCUMENTO sigue disponible: el SII sirve el PDF por ese valor.
      expect(cp.rutDocumental).toBe("55555555-5");
    }
  });

  /* GEMELO: dos documentos del MISMO extranjero SÍ se agrupan juntos (si el arreglo separara
     por documento en vez de por contraparte, ANTHROPIC quedaría en dos filas de $100.000 y
     $91.251). */
  it("dos facturas del MISMO extranjero quedan en una sola fila", () => {
    const cps = buildMaestro(docsExtranjeros(), terminos, "compras", HOY);
    const anthropic = cps.find((cp) => cp.name === "ANTHROPIC, PBC");
    expect(anthropic?.docCount).toBe(2);
    expect(anthropic?.total).toBe(191_251);
    expect(cps.filter((cp) => cp.name === "ANTHROPIC, PBC")).toHaveLength(1);
  });

  /* GEMELO: dos contrapartes con RUT REAL y nombres distintos siguen separadas, y una
     contraparte con RUT real NO pierde su RUT. */
  it("dos contrapartes con RUT real distinto siguen separadas y conservan su RUT", () => {
    const docs: DocConVencimiento[] = [
      {
        rut: "96572360-9",
        name: "COMERCIAL KAUFMANN S.A.",
        fecha: "01/06/2026",
        monto: 5_000_000,
        folio: 1,
        tipoDoc: 33,
      },
      {
        rut: "77111222-3",
        name: "OTRA EMPRESA SPA",
        fecha: "01/06/2026",
        monto: 2_000_000,
        folio: 2,
        tipoDoc: 33,
      },
    ];
    const cps = buildMaestro(docs, terminos, "compras", HOY);
    expect(cps).toHaveLength(2);
    expect(cps.map((cp) => cp.rut).sort()).toEqual(["77111222-3", "96572360-9"]);
    expect(cps.every((cp) => cp.key === cp.rut)).toBe(true);
  });

  /* GEMELO: el MISMO nombre con DOS RUT reales distintos NO se funde (si el arreglo agrupara
     por nombre siempre, dos sociedades con RUT propio colapsarían en una). */
  it("el mismo nombre con dos RUT reales distintos NO se funde", () => {
    const docs: DocConVencimiento[] = [
      { rut: "96572360-9", name: "MISMO NOMBRE", fecha: "01/06/2026", monto: 1_000, folio: 1 },
      { rut: "77111222-3", name: "MISMO NOMBRE", fecha: "01/06/2026", monto: 2_000, folio: 2 },
    ];
    const cps = buildMaestro(docs, terminos, "compras", HOY);
    expect(cps).toHaveLength(2);
    expect(cps.reduce((s, cp) => s + cp.total, 0)).toBe(3_000);
  });

  it("un cliente bajo el centinela queda en su propia fila, con su nombre", () => {
    // DIVEIMPORT llega bajo el centinela en el RCV de VENTAS: +$42.776.821 en 27 documentos.
    const ventas: DocConVencimiento[] = Array.from({ length: 27 }, (_, i) => ({
      rut: "55555555-5",
      name: "DIVEIMPORT S.A.",
      fecha: "01/06/2026",
      monto: i === 0 ? 42_776_821 - 26 : 1,
      folio: 200 + i,
      tipoDoc: 33,
    }));
    const cps = buildMaestro(ventas, terminos, "ventas", HOY);
    expect(cps).toHaveLength(1);
    expect(cps[0]!.name).toBe("DIVEIMPORT S.A.");
    expect(cps[0]!.rut).toBeNull();
    expect(cps[0]!.docCount).toBe(27);
    expect(cps[0]!.total).toBe(42_776_821);
  });

  it("el orden de recorrido no cambia el resultado", () => {
    const directo = buildMaestro(docsExtranjeros(), terminos, "compras", HOY);
    const alReves = buildMaestro([...docsExtranjeros()].reverse(), terminos, "compras", HOY);
    const resumen = (cps: ReturnType<typeof buildMaestro>) =>
      cps
        .map((cp) => `${cp.key}=${cp.total}`)
        .sort()
        .join("|");
    expect(resumen(alReves)).toBe(resumen(directo));
  });

  it("un documento sin RUT ni nombre queda en una fila explícita, no se descarta", () => {
    const docs: DocConVencimiento[] = [
      { rut: "", name: "", fecha: "01/06/2026", monto: 7_777, folio: 1, tipoDoc: 33 },
    ];
    const cps = buildMaestro(docs, terminos, "compras", HOY);
    expect(cps).toHaveLength(1);
    expect(cps[0]!.key).toBe("sin-rut:sin-identificar");
    expect(cps[0]!.rut).toBeNull();
    expect(cps[0]!.total).toBe(7_777);
  });
});

describe("overrides de plazo: una identidad débil no acepta ni aplica override", () => {
  it("termFor sobre el centinela devuelve el default del tipo, no el override guardado", () => {
    const blob = { [TERMINOS_KEY]: { compras: { default: 30, byRut: { "55555555-5": 90 } } } };
    const t = readTerminos(blob);
    // readTerminos lo descarta al LEER: limpia los blobs que ya lo tenían guardado.
    expect(t.compras.byRut).toEqual({});
    expect(termFor(t, "compras", "55555555-5")).toBe(TERMINO_DEFAULT.compras);
    expect(termFor(t, "compras", "SIN-RUT")).toBe(TERMINO_DEFAULT.compras);
    expect(termFor(t, "compras", null)).toBe(TERMINO_DEFAULT.compras);
    expect(isTermCustom(t, "compras", "55555555-5")).toBe(false);
  });

  it("un override guardado sobre el centinela NO cambia el vencimiento de los 9 proveedores", () => {
    const blob = { [TERMINOS_KEY]: { compras: { default: 30, byRut: { "55555555-5": 1 } } } };
    const cps = buildMaestro(docsExtranjeros(), readTerminos(blob), "compras", HOY);
    expect(cps).toHaveLength(9);
    for (const cp of cps) {
      expect(cp.termino).toBe(TERMINO_DEFAULT.compras);
      expect(cp.terminoCustom).toBe(false);
    }
  });

  it("withTerm no guarda un override sobre identidad débil, y limpia el que hubiera", () => {
    const blob = { [TERMINOS_KEY]: { compras: { default: 30, byRut: { "55555555-5": 90 } } } };
    const next = withTerm(blob, "compras", "55555555-5", 120);
    expect(readTerminos(next).compras.byRut).toEqual({});
    // Idempotente: aplicarlo dos veces da lo mismo.
    expect(withTerm(next, "compras", "55555555-5", 120)).toEqual(next);
  });

  it("withoutTerm sigue siendo idempotente, con y sin identidad débil", () => {
    const blob = withTerm(undefined, "compras", "96572360-9", 45);
    const sin1 = withoutTerm(blob, "compras", "96572360-9");
    const sin2 = withoutTerm(sin1, "compras", "96572360-9");
    expect(readTerminos(sin1).compras.byRut).toEqual({});
    expect(sin2).toEqual(sin1);
    expect(withoutTerm(sin1, "compras", "55555555-5")).toEqual(sin1);
  });

  /* GEMELO: una contraparte REAL sí acepta su override, lo aplica al vencimiento derivado y
     se marca como personalizado. Si el arreglo bloqueara de más, este test caería. */
  it("una contraparte con RUT real SÍ acepta y aplica su override", () => {
    const blob = withTerm(undefined, "compras", "96.572.360-9", 60);
    const t = readTerminos(blob);
    expect(t.compras.byRut).toEqual({ "96572360-9": 60 });
    expect(termFor(t, "compras", "96572360-9")).toBe(60);
    expect(isTermCustom(t, "compras", "96572360-9")).toBe(true);

    const docs: DocConVencimiento[] = [
      {
        rut: "96572360-9",
        name: "COMERCIAL KAUFMANN S.A.",
        fecha: "01/06/2026",
        monto: 1_000_000,
        folio: 1,
        tipoDoc: 33,
      },
    ];
    const cps = buildMaestro(docs, t, "compras", HOY);
    expect(cps[0]!.termino).toBe(60);
    expect(cps[0]!.terminoCustom).toBe(true);
    // 01/06 + 60 días = 31/07/2026 (con el default de 30 habría sido 01/07).
    expect(cps[0]!.docs[0]!.vencimiento?.getMonth()).toBe(6);
    expect(cps[0]!.docs[0]!.vencimiento?.getDate()).toBe(31);
  });

  it("el override de una contraparte real no se contagia a las extranjeras", () => {
    const blob = withTerm(undefined, "compras", "96572360-9", 90);
    const docs: DocConVencimiento[] = [
      ...docsExtranjeros(),
      {
        rut: "96572360-9",
        name: "COMERCIAL KAUFMANN S.A.",
        fecha: "01/06/2026",
        monto: 1_000_000,
        folio: 1,
        tipoDoc: 33,
      },
    ];
    const cps = buildMaestro(docs, readTerminos(blob), "compras", HOY);
    expect(cps.find((cp) => cp.rut === "96572360-9")?.termino).toBe(90);
    for (const cp of cps.filter((c) => c.rut === null)) {
      expect(cp.termino).toBe(TERMINO_DEFAULT.compras);
    }
  });
});
