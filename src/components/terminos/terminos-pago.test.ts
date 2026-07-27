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
  totalesMaestro,
  readPagados,
  isPagado,
  withPagado,
  withoutPagado,
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

describe("pagados (prefs)", () => {
  it("readPagados defensivo + round-trip with/without", () => {
    expect(readPagados(undefined)).toEqual({});
    expect(readPagados({ [PAGADOS_KEY]: "nope" })).toEqual({});
    const marked = withPagado(undefined, "compras", "77.111.222-3", 1002, "2026-07-20");
    expect(isPagado(readPagados(marked), "compras", "77111222-3", 1002)).toBe(true);
    // distinto folio / distinto tipo → no está pagado
    expect(isPagado(readPagados(marked), "compras", "77111222-3", 9999)).toBe(false);
    expect(isPagado(readPagados(marked), "ventas", "77111222-3", 1002)).toBe(false);
    const undone = withoutPagado(marked, "compras", "77111222-3", 1002);
    expect(isPagado(readPagados(undone), "compras", "77111222-3", 1002)).toBe(false);
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

  it("una Nota de Crédito (tipo 61) RESTA del total y del vencido; suma su magnitud", () => {
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
    expect(k.vencido).toBe(3_000_000); // ambos vencidos → neto 3M
    const nc = k.docs.find((d) => d.folio === 2)!;
    expect(nc.esNotaCredito).toBe(true);
    expect(nc.monto).toBe(-2_000_000); // firmado negativo
  });

  it("la NC 'por vencer' netea el VENCIDO primero (caso TD Synnex): vencido ≤ total", () => {
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
    expect(k.vencido).toBe(1_663_148); // la NC netea el vencido de más viejo a más nuevo
    expect(k.porVencer).toBe(0);
    expect(k.vencido).toBeLessThanOrEqual(k.total); // nunca vencido > total
  });

  it("una NC con ref anula su factura: quedan juntas (NC sigue a la factura) + estado anulada", () => {
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
    expect(k.vencido).toBe(0);
    // La factura y su NC quedan contiguas: factura primero, NC (anula N° 100) debajo.
    expect(k.docs[0]!.folio).toBe(100);
    expect(k.docs[0]!.esNotaCredito).toBe(false);
    expect(k.docs[0]!.anulacion).toBe("anulada");
    expect(k.docs[1]!.folio).toBe(200);
    expect(k.docs[1]!.esNotaCredito).toBe(true);
    expect(k.docs[1]!.refFolio).toBe(100);
  });

  it("una NC vinculada que SOBRE-acredita su factura no deja vencido > saldo (re-balance)", () => {
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
    // El exceso de $1M de la NC (que pisó el bucket de #2 en 0) baja el vencido de $5M a $4M.
    expect(k.vencido).toBe(4_000_000);
    expect(k.vencido).toBeLessThanOrEqual(k.total); // invariante restaurada
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

  it("una factura FUTURA anulada al 100% no cuenta como próximo vencimiento (neto 0)", () => {
    // Factura del 18/07 (vence 17/08, futura vs HOY 20/07) anulada por su NC → neto 0.
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
    expect(k.docs.find((d) => d.folio === 300)!.anulacion).toBe("anulada");
    // Antes del fix el próximo apuntaba al 17/08 de la factura anulada; ahora es null (no hay deuda futura real).
    expect(k.proximoVencimiento).toBeNull();
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

  it("un doc marcado pagado sale del vencido y cuenta como pagado", () => {
    const t = readTerminos(undefined);
    // Marcar pagada la factura vencida de Kaufmann (folio 1).
    const pagados = readPagados(withPagado(undefined, "ventas", "96572360-9", 1, "2026-07-20"));
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
