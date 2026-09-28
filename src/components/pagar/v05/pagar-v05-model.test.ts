import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/formatters/clp";
import { sale14d } from "@/components/caja/v02/caja-v02-model";
import {
  LEY_9_TEXTO,
  certezaLabelDe,
  coincideConsulta,
  contarPagos,
  csvPagos,
  diasHasta,
  documentoDe,
  elUnicoRojo,
  esPostergable,
  estimadasDe,
  explicacionCritico,
  explicacionPorPagar,
  explicacionVencido,
  faltantes,
  filtrarPagos,
  kpiCritico,
  kpiPorPagar,
  kpiVencido,
  nombreDe,
  ordenarPorUrgencia,
  pagosV05,
  tipoDe,
  totales,
  venceLabelDe,
} from "./pagar-v05-model";
import {
  ARRIENDO_SIN_CONFIRMAR,
  BICE,
  ANOMALIA_ENTEL,
  CHIPAX,
  ENTEL_A,
  ENTEL_B,
  F29,
  F29_ESTIMADO,
  HOY,
  KENNEDY,
  REMUNERACIONES,
  TELEFONICA_ESTIMADA,
  pagos,
  pagosAuditoriaD01,
  pagosConDuplicado,
  pagosConFechasEstimadas,
  pagosDegradados,
  pagosListaTopeadaSinCriticos,
  pagosSoloImpuestosYSueldos,
  pagosVacio,
} from "./pagar-v05-fixtures";

/* V05 · Pagar — el modelo puro, sin DOM. Cada afirmación de plata de la pantalla se fija acá:
 * el orden por urgencia, la regla de duplicados (con sus gemelos negativos), la Ley 9, el
 * vencido ≠ crítico, la moneda (INV-FX-001) y el "no sé" de las fechas. */

const filas = () => pagosV05(pagos(), HOY);

describe("fechas — el 'no sé' es explícito, nunca 0 días ni 'vence hoy'", () => {
  it("sin fecha parseable → null (no 0)", () => {
    expect(diasHasta("", HOY)).toBeNull();
    expect(diasHasta(null, HOY)).toBeNull();
    expect(diasHasta("Sin información", HOY)).toBeNull();
    // Gemelo positivo: hoy es 0 de verdad, y ayer es −1.
    expect(diasHasta("2026-08-30", HOY)).toBe(0);
    expect(diasHasta("2026-08-29", HOY)).toBe(-1);
  });

  it("venceLabel: corto en el año en curso, LARGO cruzando el año, 'sin fecha' sin fecha", () => {
    expect(venceLabelDe("2026-09-01", HOY)).toBe("1 sep");
    expect(venceLabelDe("2025-03-03", HOY)).toBe("3 mar 2025");
    expect(venceLabelDe("", HOY)).toBe("sin fecha");
  });

  it("una fila que llega sin fecha dice 'sin fecha' en todos lados", () => {
    const f = pagosV05(pagosDegradados(), HOY).find((p) => p.nombre.startsWith("Aguas"));
    expect(f).toBeDefined();
    expect(f!.dias).toBeNull();
    expect(f!.venceLabel).toBe("sin fecha");
    expect(f!.relativoLabel).toBe("sin fecha");
    expect(f!.vencido).toBe(false);
    expect(f!.critico).toBe(false);
    // Gemelo: la fila CON fecha del mismo fixture sí tiene relativo.
    const g = pagosV05(pagosDegradados(), HOY).find((p) => p.nombre.startsWith("Banco BICE"));
    expect(g!.relativoLabel).toBe("en 2 días");
  });
});

describe("identidad de la fila", () => {
  it("nómina (ADR-0056): el label literal 'Remuneraciones' se completa con el período", () => {
    expect(nombreDe(REMUNERACIONES)).toBe("Remuneraciones: Agosto 2026");
  });

  it("DTE: razón social completa + documento; sin contraparte cae al label del backend", () => {
    expect(nombreDe(KENNEDY)).toBe("Inmobiliaria Vista Kennedy SpA");
    expect(documentoDe(KENNEDY)).toBe("Factura 1201");
    expect(nombreDe(F29)).toBe("F29 · IVA de julio");
    expect(documentoDe(F29)).toBeNull();
  });
});

describe("tipo y Ley 9 — impuestos y sueldos jamás son postergables", () => {
  it("tax y payroll NUNCA son postergables, con cualquier criticidad", () => {
    for (const criticality of ["high", "medium", "low"] as const) {
      expect(esPostergable({ category: "tax", criticality })).toBe(false);
      expect(esPostergable({ category: "payroll", criticality })).toBe(false);
    }
    // Gemelo positivo: un proveedor sí.
    expect(esPostergable({ category: "supplier", criticality: "high" })).toBe(true);
  });

  it("pill: deuda → Crédito; impuestos/sueldos → No se posterga; proveedor → Negociable", () => {
    expect(tipoDe(BICE)).toBe("credito");
    expect(tipoDe(F29)).toBe("no_se_posterga");
    expect(tipoDe(REMUNERACIONES)).toBe("no_se_posterga");
    expect(tipoDe(KENNEDY)).toBe("negociable");
  });

  it("el texto fijo de la Ley 9 es literal", () => {
    expect(LEY_9_TEXTO).toBe("Impuestos y sueldos jamás entran en postergaciones automáticas.");
  });
});

describe("orden por urgencia (default de la tabla)", () => {
  it("lo más vencido primero, después lo que vence antes, al final lo sin fecha", () => {
    expect(filas().map((p) => p.nombre)).toEqual([
      "Inmobiliaria Vista Kennedy SpA",
      "Soc. de Profesionales Vásquez, González y Cía.",
      "Entel PCS Telecomunicaciones S.A.",
      "Banco BICE",
      "Remuneraciones: Agosto 2026",
      "MercadoLibre Chile Ltda.",
      "F29 · IVA de julio",
      "Chipax SpA",
    ]);
    const deg = pagosV05(pagosDegradados(), HOY);
    expect(deg.at(-1)!.venceLabel).toBe("sin fecha");
  });

  it("a igual día, primero lo que no se posterga y después el monto mayor", () => {
    const mismoDia = ordenarPorUrgencia([
      { dias: 5, tipo: "negociable" as const, montoClp: 100 },
      { dias: 5, tipo: "no_se_posterga" as const, montoClp: 50 },
      { dias: 5, tipo: "negociable" as const, montoClp: 900 },
    ]);
    expect(mismoDia.map((p) => p.montoClp)).toEqual([50, 900, 100]);
  });

  it("con el Brief conserva el orden publicado y no fabrica señales de postergabilidad", () => {
    const ap = pagos({ items: [CHIPAX, BICE, KENNEDY] });
    const evidencia = pagosV05(ap, HOY, [], {
      order: "source",
      includeDecisionSignals: false,
    });

    expect(evidencia.map((p) => p.item.id)).toEqual(ap.items!.map((item) => item.id));
    expect(evidencia.every((p) => p.tipo === null && !p.critico && !p.postergable)).toBe(true);
  });
});

describe("posible duplicado — sólo el par UUID publicado por el backend", () => {
  it("el par de anomalías marca las DOS filas por UUID", () => {
    const dup = pagosV05(pagosConDuplicado(), HOY, [ANOMALIA_ENTEL]);
    const a1 = dup.find((p) => p.key === ENTEL_A.id)!;
    const b1 = dup.find((p) => p.key === ENTEL_B.id)!;
    expect(a1.anomalia).not.toBeNull();
    expect(a1.anomalia!.parKey).toBe(ENTEL_B.id);
    expect(a1.tipo).toBe("revisar");
    expect(a1.sub).toBe(
      "posible duplicado señalado por el registro: Factura 9017 (27 ago, $205.000)",
    );
    expect(b1.anomalia!.parKey).toBe(ENTEL_A.id);
  });

  it("dos filas que se parecen por RUT, monto y fecha NO se marcan sin par UUID", () => {
    const sinPar = pagosV05(pagosConDuplicado(), HOY, []);
    expect(sinPar.find((p) => p.key === ENTEL_A.id)!.anomalia).toBeNull();
    expect(sinPar.find((p) => p.key === ENTEL_B.id)!.anomalia).toBeNull();
  });

  it("si el par incluye un pago fuera de los visibles, no inventa sus datos", () => {
    const soloA = pagosV05(pagos({ items: [ENTEL_A] }), HOY, [ANOMALIA_ENTEL]);
    expect(soloA[0]!.sub).toContain("el otro pago no está entre los visibles");
  });
});

describe("Ley 2 — el único rojo lo decide el modelo", () => {
  it("con un duplicado, el rojo es la anomalía más urgente (no la fila crítica)", () => {
    const rojo = elUnicoRojo(pagosV05(pagosConDuplicado(), HOY, [ANOMALIA_ENTEL]));
    expect(rojo).toEqual({ key: ENTEL_A.id, motivo: "anomalia" });
  });

  it("sin duplicados, el rojo es la fila crítica más urgente", () => {
    expect(elUnicoRojo(filas())).toEqual({ key: BICE.id, motivo: "critico" });
  });

  it("sin duplicados ni críticos no hay rojo", () => {
    const soloNegociables = pagosV05(pagos({ items: [KENNEDY, CHIPAX] }), HOY);
    expect(elUnicoRojo(soloNegociables)).toBeNull();
  });
});

describe("tríada — vencido ≠ crítico, con las cifras al peso", () => {
  it("Vencido: $8.729.650 en 3 pagos, el más antiguo hace 545 días (la factura de 18 meses)", () => {
    const v = kpiVencido(filas());
    expect(v.total).toBe(8_729_650);
    expect(v.n).toBe(3);
    expect(v.masAntiguoDias).toBe(545);
    expect(v.noPostergable).toBe(0);
  });

  it("Por pagar: los tramos del backend tal cual (7/14/30), sin recalcular de la tabla", () => {
    expect(kpiPorPagar(pagos(), 7).total).toBe(16_632_726);
    expect(kpiPorPagar(pagos(), 14).total).toBe(17_998_105);
    expect(kpiPorPagar(pagos(), 30).total).toBe(19_205_210);
    expect(kpiPorPagar(pagos(), 14).sinFecha).toBeNull();
    expect(kpiPorPagar(pagosDegradados(), 14).sinFecha).toEqual({ monto: 2_450_000, n: 3 });
    expect(
      kpiPorPagar(pagos({ undated_count: 1, undated_amount: undefined }), 14).sinFecha,
    ).toEqual({
      monto: null,
      n: 1,
    });
    expect(kpiPorPagar(null, 14).total).toBeNull();
  });

  it("Ley 1: 'Por pagar · 14 días' ES el total de 'Sale · 14 días' de V02 (misma función base)", () => {
    const deV02 = sale14d(pagos(), HOY);
    expect(kpiPorPagar(pagos(), 14).total).toBe(deV02!.total);
  });

  it("mantiene caja final, críticos y cobertura canónica como conceptos separados", () => {
    const c = kpiCritico(filas(), pagos());
    expect(c.total).toBe(16_807_705);
    expect(c.n).toBe(6);
    expect(c.monedasExcluidas).toBe(0);
    expect(c.yaVencido).toBe(8_729_650);
    expect(c.cajaFinal).toBe(5_200_000);
    expect(c.monedaCaja).toBe("CLP");
    expect(c.cobertura).toBe(false);
    expect(c).not.toHaveProperty("brecha");
    expect(c.motivoSinCaja).toBeNull();
  });

  it("auditoría D01: −$46.865.254 y $10.373.669 nunca producen −$57.238.923", () => {
    const ap = pagosAuditoriaD01();
    const c = kpiCritico(pagosV05(ap, HOY), ap);

    expect(c.cajaFinal).toBe(-46_865_254);
    expect(c.total).toBe(10_373_669);
    expect(c.cobertura).toBe(false);
    expect(c).not.toHaveProperty("brecha");
    expect(Math.abs(c.cajaFinal!) + c.total!).toBe(57_238_923);
  });

  it("no redefine covers_critical comparando el saldo final con los críticos", () => {
    const ap = pagos({ projected_cash_14d: "1", covers_critical: true });
    expect(kpiCritico(pagosV05(ap, HOY), ap).cobertura).toBe(true);
  });

  it("USD 830 crítico sin tipo de cambio conserva el conteo y el monto desconocido", () => {
    const usdSinTc = {
      ...BICE,
      amount: "830",
      currency: "USD",
      amount_clp: null,
    };
    const ap = pagos({
      items: [usdSinTc],
      covers_critical: false,
      non_postponable_or_overdue_14d: {
        amount_clp: null,
        known_amount_clp: "0",
        complete: false,
        count: 1,
        unknown_due_date_count: 0,
        excluded_by_currency: [{ currency: "USD", amount: "830", currency_status: "verified" }],
      },
    });
    const c = kpiCritico(pagosV05(ap, HOY), ap);

    expect(c.total).toBe(0);
    expect(c.n).toBe(1);
    expect(c.fechasDesconocidas).toBe(0);
    expect(c.monedasExcluidas).toBe(1);
    expect(c.cobertura).toBe(false);
  });

  it("100 ítems negociables visibles no ocultan el crítico global fuera de la página", () => {
    const ap = pagosListaTopeadaSinCriticos();
    const c = kpiCritico(pagosV05(ap, HOY), ap);

    expect(c.total).toBe(250_000);
    expect(c.n).toBe(1);
    expect(c.monedasExcluidas).toBe(0);
    expect(c.cobertura).toBe(false);
  });

  it("la factura de proveedor vencida hace 18 meses NO es crítica (es negociable y vencida)", () => {
    const kennedy = filas()[0]!;
    expect(kennedy.vencido).toBe(true);
    expect(kennedy.critico).toBe(false);
    // Gemelo: la nómina por vencer SÍ es crítica.
    expect(filas().find((p) => p.categoria === "payroll")!.critico).toBe(true);
  });

  it("caja en otra moneda conserva unidad y cobertura indeterminada; no se compara", () => {
    const c = kpiCritico(pagosV05(pagosDegradados(), HOY), pagosDegradados());
    expect(c.cajaFinal).toBe(10_500);
    expect(c.monedaCaja).toBe("USD");
    expect(c.cobertura).toBeNull();
    expect(c.motivoSinCobertura).toContain("no se pudo determinar");
    // Gemelo: sin proyección, el motivo es otro.
    const sinProy = kpiCritico(filas(), pagos({ projected_cash_14d: null }));
    expect(sinProy.motivoSinCaja).toBe("no se pudo proyectar el saldo final a 14 días");
  });

  it("un saldo proyectado que el servidor NO declara publicable no se muestra", () => {
    /* El productor manda el número y, por separado, si puede publicarse. Con la bandera en
       false la pantalla se abstiene aunque el monto venga: leerlo igual sería publicar una
       cifra que el servidor no respalda. Mata el mutante
       `cajaFinal = parseAmountOrNull(ap?.projected_cash_14d)` sin el gate. */
    const noPublicable = pagos({
      cash_projection_publicable_14d: false,
      projected_cash_14d: "5200000",
      min_14d: null,
      cash_gap_amount_14d: null,
      has_gap: null,
      covers_critical: null,
    });
    const c = kpiCritico(pagosV05(noPublicable, HOY), noPublicable);
    expect(c.cajaFinal).toBeNull();
    expect(c.cajaFinal).not.toBe(5_200_000);
    expect(c.motivoSinCaja).toBe("no se pudo proyectar el saldo final a 14 días");
    // Gemelo positivo: el MISMO monto, declarado publicable, sí se muestra.
    expect(kpiCritico(filas(), pagos()).cajaFinal).toBe(5_200_000);
  });

  it("#370: sin moneda verificada no hay cifra de caja ni se rotula CLP", () => {
    /* qavante-api#905: `projected_cash_currency` puede venir `null`. Aunque llegue un monto
       (payload que no pasó por el boundary), sin unidad no se publica. Mata los mutantes
       `|| "CLP"` y "mostrar el monto sin moneda". */
    const sinMoneda = pagos({ projected_cash_currency: null });
    const c = kpiCritico(filas(), sinMoneda);
    expect(c.monedaCaja).toBeNull();
    expect(c.monedaCaja).not.toBe("CLP");
    expect(c.cajaFinal).toBeNull();
    expect(c.motivoSinCaja).toBe(
      "la moneda del saldo proyectado no está verificada, así que no lo mostramos",
    );
    // Gemelo positivo: el mismo payload con moneda verificada sí publica la cifra.
    const conMoneda = kpiCritico(filas(), pagos({ projected_cash_currency: "CLP" }));
    expect(conMoneda.cajaFinal).toBe(5_200_000);
    expect(conMoneda.monedaCaja).toBe("CLP");
  });
});

describe("filtros con conteo + búsqueda", () => {
  it("conteos del caso normal", () => {
    expect(contarPagos(filas())).toEqual({
      todos: 8,
      vencidos: 3,
      criticos: 3,
      postergables: 5,
      impuestos: 1,
      remuneraciones: 1,
      revisar: 0,
      sin_fecha: 0,
    });
  });

  it("Ley 9: con sólo impuestos y sueldos, Postergables cuenta CERO (y el filtro los muestra)", () => {
    const conteos = contarPagos(pagosV05(pagosSoloImpuestosYSueldos(), HOY));
    expect(conteos.postergables).toBe(0);
    expect(conteos.impuestos).toBe(1);
    expect(conteos.remuneraciones).toBe(2);
    // Gemelo positivo: en el caso normal Postergables NO es cero.
    expect(contarPagos(filas()).postergables).toBe(5);
  });

  it("filtrar por críticos deja deuda + sueldos + F29", () => {
    expect(filtrarPagos(filas(), "criticos").map((p) => p.categoria)).toEqual([
      "debt",
      "payroll",
      "tax",
    ]);
  });

  it("búsqueda por nombre, folio y RUT (con o sin puntos)", () => {
    const f = filas();
    expect(filtrarPagos(f, "todos", "entel")).toHaveLength(1);
    expect(filtrarPagos(f, "todos", "9001")).toHaveLength(1);
    expect(filtrarPagos(f, "todos", "76.555.555-5")).toHaveLength(1);
    expect(filtrarPagos(f, "todos", "gorbea")).toHaveLength(0);
    expect(coincideConsulta(f[0]!, "  ")).toBe(true);
  });
});

describe("moneda (INV-FX-001) y totales del footer", () => {
  it("la fila USD muestra su moneda de origen y suma por su amount_clp", () => {
    const meli = filas().find((p) => p.moneda === "USD")!;
    expect(meli.montoLabel).toBe(formatMoney(1240, "USD"));
    expect(meli.montoClp).toBe(1_190_400);
    expect(meli.sinConvertir).toBe(false);
    expect(meli.sub).toContain("$1.190.400 al tipo de cambio");
  });

  it("USD sin tipo de cambio: montoClp null, no suma, y se declara", () => {
    const aws = pagosV05(pagosDegradados(), HOY).find((p) => p.nombre.startsWith("Amazon"))!;
    expect(aws.sinConvertir).toBe(true);
    expect(aws.montoClp).toBeNull();
    expect(aws.sub).toContain("sin tipo de cambio: no se suma como pesos");
    expect(totales(pagosDegradados(), pagosV05(pagosDegradados(), HOY)).sinConvertir).toBe(1);
  });

  it("el total del footer es el del backend, con su desglose crudo por moneda", () => {
    const t = totales(pagos(), filas());
    expect(t.totalClp).toBe(19_205_210);
    expect(t.porMoneda.map((m) => m.moneda)).toEqual(["CLP", "USD"]);
    expect(t.porMoneda[1]!.label).toBe(formatMoney(1240, "USD"));
    expect(t.posiblementeTopeado).toBe(false);
  });
});

describe("explicaciones (§1.4) y faltantes", () => {
  it("cada ⓘ declara la fuente compartida con V02 y la frescura", () => {
    for (const e of [
      explicacionVencido(pagos(), HOY),
      explicacionPorPagar(pagos(), 14, HOY),
      explicacionCritico(pagos(), HOY),
    ]) {
      expect(e.fuente).toContain("Cuentas por pagar");
      expect(e.fuente).toContain("flujo de caja");
      expect(e.frescura).toContain("30 ago 2026");
    }
  });

  it("faltantes junta lo que el backend declara", () => {
    expect(faltantes(pagosVacio())).toBe("Conectar SII");
    expect(faltantes(pagos())).toBeNull();
  });
});

describe("CSV (§5.5)", () => {
  it("una fila por pago, con el 'no sé' escrito y sin inventar montos", () => {
    const csv = csvPagos(pagosV05(pagosDegradados(), HOY));
    const lineas = csv.split("\n");
    expect(lineas[0]).toBe(
      "proveedor;documento;rut;vence;dias;certeza_fecha;nota_fecha;tipo;moneda;monto;monto_clp;fuente;anomalia",
    );
    expect(csv).toContain("Aguas Cordillera S.A.;Factura 310;76777777-7;sin fecha;sin fecha");
    expect(csv).toContain(
      "Amazon Web Services;Factura 4410;76888888-8;2026-09-05;6;confirmada;;Negociable;USD;830;sin dato",
    );
    expect(lineas).toHaveLength(1 + 6);
  });

  it("con el Brief no exporta la columna heurística Tipo", () => {
    const evidencia = pagosV05(pagos(), HOY, [], {
      order: "source",
      includeDecisionSignals: false,
    });
    const encabezado = csvPagos(evidencia, { includeDecisionSignals: false }).split("\n")[0];

    expect(encabezado).not.toContain("tipo");
    expect(encabezado).toBe(
      "proveedor;documento;rut;vence;dias;certeza_fecha;nota_fecha;moneda;monto;monto_clp;fuente;anomalia",
    );
  });

  it("exporta la certeza y la nota del servidor tal cual; sin nota, la celda va vacía", () => {
    const csv = csvPagos(pagosV05(pagosConFechasEstimadas(), HOY));
    expect(csv).toContain(
      'Telefónica Chile S.A.;Factura 4471;76999999-9;2026-09-03;4;estimada;"Fecha estimada a 30 días desde la emisión; el documento no trae vencimiento pactado.";Negociable',
    );
    expect(csv).toContain(
      "Inmobiliaria Los Leones Ltda.;;;2026-08-20;-10;sin confirmar;;Negociable",
    );
    expect(csv).toContain("Banco BICE;;;2026-09-01;2;confirmada;;Crédito");
  });
});

describe("certeza de la fecha — server-owned, nunca inferida (contrato #558)", () => {
  const filasCerteza = () => pagosV05(pagosConFechasEstimadas(), HOY);
  const fila = (nombre: string) => filasCerteza().find((p) => p.nombre.startsWith(nombre))!;

  it("lee los tres valores del contrato y la nota tal cual; nota vacía → null, no un texto inventado", () => {
    expect(fila("Telefónica").certeza).toBe("estimated");
    expect(fila("Telefónica").notaVencimiento).toBe(
      "Fecha estimada a 30 días desde la emisión; el documento no trae vencimiento pactado.",
    );
    expect(fila("Inmobiliaria Los Leones").certeza).toBe("unconfirmed");
    expect(fila("Inmobiliaria Los Leones").notaVencimiento).toBeNull();
    expect(fila("Banco BICE").certeza).toBe("confirmed");
    expect(fila("Banco BICE").notaVencimiento).toBeNull();
  });

  it("la etiqueta de la fila lleva la nota cuando existe y sólo el estado cuando no; confirmada no lleva nada", () => {
    expect(certezaLabelDe(fila("Telefónica"))).toBe(
      "Fecha estimada · Fecha estimada a 30 días desde la emisión; el documento no trae vencimiento pactado.",
    );
    expect(certezaLabelDe(fila("Inmobiliaria Los Leones"))).toBe("Fecha sin confirmar");
    expect(certezaLabelDe(fila("Banco BICE"))).toBeNull();
    // El `.sub` también lleva la nota, sin reescribirla.
    expect(fila("Telefónica").sub).toBe(
      "Factura 4471 · SII · Fecha estimada a 30 días desde la emisión; el documento no trae vencimiento pactado.",
    );
    expect(fila("Inmobiliaria Los Leones").sub).toBe("Manual");
  });

  it("una fecha ESTIMADA o SIN CONFIRMAR nunca es vencida ni crítica; la misma fecha confirmada sí", () => {
    // Impuesto a 6 días: confirmado sería crítico (Ley 9 + ventana); estimado, no.
    expect(fila("F29").critico).toBe(false);
    expect(fila("F29").dias).toBe(6);
    const [f29Confirmado] = pagosV05(
      pagos({ items: [{ ...F29_ESTIMADO, due_date_certainty: "confirmed" }] }),
      HOY,
    );
    expect(f29Confirmado!.critico).toBe(true); // gemelo positivo con la MISMA fecha
    // Arriendo con fecha pasada sin confirmar: se ordena por su fecha, pero no es "vencido".
    expect(fila("Inmobiliaria Los Leones").dias).toBe(-10);
    expect(fila("Inmobiliaria Los Leones").vencido).toBe(false);
    const [arriendoConfirmado] = pagosV05(
      pagos({ items: [{ ...ARRIENDO_SIN_CONFIRMAR, due_date_certainty: "confirmed" }] }),
      HOY,
    );
    expect(arriendoConfirmado!.vencido).toBe(true);
    // Y por eso el filtro local de vencidos y el rojo no los cuentan.
    expect(contarPagos(filasCerteza()).vencidos).toBe(1); // sólo Kennedy
    expect(elUnicoRojo(filasCerteza())).toEqual({ key: BICE.id, motivo: "critico" });
  });

  it("sin el campo NO se asume confirmada: certeza 'no informada', ni vencida ni crítica", () => {
    const sinCampo = {
      ...F29_ESTIMADO,
      due_date_certainty: undefined,
      due_date_note: undefined,
    } as unknown as typeof F29_ESTIMADO;
    const [p] = pagosV05(pagos({ items: [sinCampo] }), HOY);
    expect(p!.certeza).toBe("no_informada");
    expect(p!.notaVencimiento).toBeNull();
    expect(p!.critico).toBe(false);
    expect(certezaLabelDe(p!)).toBe("Certeza no informada");
    // Un valor fuera del enum tampoco se traduce a "confirmada".
    const raro = { ...KENNEDY, due_date_certainty: "verified" as never };
    const [q] = pagosV05(pagos({ items: [raro] }), HOY);
    expect(q!.certeza).toBe("no_informada");
    expect(q!.vencido).toBe(false);
    expect(pagosV05(pagos({ items: [KENNEDY] }), HOY)[0]!.vencido).toBe(true); // gemelo
  });

  it("el orden por urgencia sigue usando la fecha (útil para ordenar), sin ascenderla a mora", () => {
    const nombres = filasCerteza().map((p) => p.nombre);
    expect(nombres.indexOf("Inmobiliaria Los Leones Ltda.")).toBeLessThan(
      nombres.indexOf("Banco BICE"),
    );
    expect(nombres.indexOf("Telefónica Chile S.A.")).toBeLessThan(nombres.indexOf("Chipax SpA"));
  });

  it("estimated_due_date_count es del servidor: se publica en Por pagar; sin el campo es null, no 0", () => {
    expect(estimadasDe(pagosConFechasEstimadas())).toBe(2);
    expect(kpiPorPagar(pagosConFechasEstimadas(), 14).estimadas).toBe(2);
    expect(kpiPorPagar(pagos(), 14).estimadas).toBe(0);
    expect(estimadasDe(pagos({ estimated_due_date_count: undefined as never }))).toBeNull();
    expect(estimadasDe(null)).toBeNull();
    // No se recuenta desde la página: el servidor dice 5 aunque la página traiga 2.
    expect(estimadasDe(pagosConFechasEstimadas({ estimated_due_date_count: 5 }))).toBe(5);
  });

  it("el ⓘ de Por pagar declara que lo estimado queda fuera de los tramos, con el conteo del servidor", () => {
    const con = explicacionPorPagar(pagosConFechasEstimadas(), 14, HOY);
    expect(con.excluye).toContain(
      "Pagos con fecha estimada: el registro los cuenta aparte y no los mete en ningún tramo",
    );
    expect(con.excluye).toContain("Hoy: 2 pagos con fecha estimada según el registro");
    const sin = explicacionPorPagar(pagos(), 14, HOY);
    expect(sin.excluye.some((x) => x.startsWith("Hoy:"))).toBe(false);
    expect(TELEFONICA_ESTIMADA.due_date_certainty).toBe("estimated"); // el fixture usa el enum
  });
});
