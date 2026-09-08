import { describe, expect, it } from "vitest";
import type { F29EstadoMes } from "@/lib/api/sii";
import type { TgrMovimiento } from "@/lib/api/tgr";
import {
  ESTADO_LABEL_V06,
  F29_ESTIMADO_MOTIVO,
  LEY_9_TEXTO_V06,
  csvCalendarioV06,
  elUnicoRojoV06,
  estimacionF29V06,
  f29EstimadoHuecoV06,
  filaF29DeMes,
  filaF29PostergadoDeMes,
  filaPreviredV06,
  filasCalendarioV06,
  filasTgrV06,
  ordenarFilasV06,
  proximoVencimientoV06,
  triadaTgrV06,
  ventanaPeriodosV06,
  type FilaCalendarioV06,
} from "./impuestos-v06-model";
import {
  F29_IMPUESTO_ESTIMABLE_V06,
  F29_IMPUESTO_NO_ESTIMABLE_V06,
  HOY_V06,
  mesesF29V06,
  tgrMovimientosV06,
} from "./impuestos-v06-fixtures";

/* Modelo puro de V06 · Impuestos. Cada afirmación de la pantalla — la tríada, cada fila del
 * calendario, el único rojo y el F-29 estimado — se fija acá sin montar un DOM (mismo
 * patrón que `presupuesto-v09-model.test.ts`). */

describe("ventanaPeriodosV06", () => {
  it("los últimos 6 meses, ascendente, terminando en el mes de hoy", () => {
    expect(ventanaPeriodosV06(HOY_V06)).toEqual([
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
  });

  it("cruza el borde de año sin perder meses", () => {
    expect(ventanaPeriodosV06(new Date(2026, 1, 10), 4)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("respeta la cantidad pedida", () => {
    expect(ventanaPeriodosV06(HOY_V06, 3)).toEqual(["2026-06", "2026-07", "2026-08"]);
  });
});

describe("filaF29DeMes — declarado", () => {
  const mes: F29EstadoMes = {
    mes: 3,
    periodo: "2026-03",
    estado: "declarado",
    declarado: true,
    folio: 1000001,
    saldo: 850000,
    remanente: 0,
    vencimiento: "2026-04-12",
  };

  it("declarado con saldo: monto real, sin motivo, resuelto", () => {
    const fila = filaF29DeMes(mes, HOY_V06);
    expect(fila.estado).toBe("declarado");
    expect(fila.monto).toBe(850000);
    expect(fila.motivoSinMonto).toBeNull();
    expect(fila.resuelto).toBe(true);
    expect(fila.label).toBe("F-29 · Marzo 2026");
    expect(fila.href).toBe("/pagar/impuestos/f29");
  });

  it("declarado con saldo null: 'sin dato' explícito, NUNCA $0", () => {
    const fila = filaF29DeMes({ ...mes, saldo: null }, HOY_V06);
    expect(fila.monto).toBeNull();
    expect(fila.monto).not.toBe(0);
    expect(fila.motivoSinMonto).toBe("El SII declaró este F-29 sin dejar el monto parseado.");
  });
});

describe("filaF29DeMes — sin estimación aplicable", () => {
  const base: F29EstadoMes = {
    mes: 7,
    periodo: "2026-07",
    estado: "no_declarado_vencido",
    declarado: false,
    folio: null,
    saldo: null,
    remanente: null,
    vencimiento: "2026-08-12",
  };

  it("no_declarado_vencido: sin monto, motivo explícito, no resuelto", () => {
    const fila = filaF29DeMes(base, HOY_V06);
    expect(fila.monto).toBeNull();
    expect(fila.motivoSinMonto).toBe(F29_ESTIMADO_MOTIVO);
    expect(fila.resuelto).toBe(false);
    expect(fila.dias).toBe(-3);
    expect(fila.vencimientoLabel).not.toMatch(/^\$/); // nunca un monto disfrazado de fecha
  });

  it("por_declarar: sin monto, mismo motivo de ausencia", () => {
    const fila = filaF29DeMes({ ...base, estado: "por_declarar" }, HOY_V06);
    expect(fila.monto).toBeNull();
    expect(fila.motivoSinMonto).toBe(F29_ESTIMADO_MOTIVO);
    expect(fila.sub).toBe("Aún no vence");
  });

  it("en_curso: sin monto cuando no recibió el contrato del período", () => {
    const fila = filaF29DeMes({ ...base, estado: "en_curso" }, HOY_V06);
    expect(fila.monto).toBeNull();
    expect(fila.motivoSinMonto).toBe(F29_ESTIMADO_MOTIVO);
  });

  it("sin_dato: sin monto y sub distinto (pide sincronizar)", () => {
    const fila = filaF29DeMes({ ...base, estado: "sin_dato" }, HOY_V06);
    expect(fila.monto).toBeNull();
    expect(fila.sub).toMatch(/sincroniza/i);
  });
});

describe("filaF29PostergadoDeMes — se MUESTRA, nunca se OFRECE (Ley 9)", () => {
  const mes: F29EstadoMes = {
    mes: 4,
    periodo: "2026-04",
    estado: "declarado",
    declarado: true,
    folio: 1000002,
    saldo: 920000,
    remanente: 0,
    vencimiento: "2026-05-12",
    postergado_iva: true,
    monto_postergado: 300000,
    vencimiento_postergado: "2026-10-20",
  };

  it("postergado con monto y fecha: fila separada con el monto real", () => {
    const fila = filaF29PostergadoDeMes(mes, HOY_V06);
    expect(fila).not.toBeNull();
    expect(fila!.monto).toBe(300000);
    expect(fila!.vencimiento).toBe("2026-10-20");
    expect(fila!.estado).toBe("iva_postergado");
    // El texto aclara que es del SII, no una postergación de Qavante.
    expect(fila!.sub).toContain("SII");
    expect(fila!.sub).not.toMatch(/Qavante (la )?ofrece/i);
  });

  it("sin postergación: null (gemelo negativo)", () => {
    expect(filaF29PostergadoDeMes({ ...mes, postergado_iva: false }, HOY_V06)).toBeNull();
  });

  it("postergado pero sin fecha diferida: null (dato roto, no se inventa la fecha)", () => {
    expect(filaF29PostergadoDeMes({ ...mes, vencimiento_postergado: null }, HOY_V06)).toBeNull();
  });

  it("monto_postergado null: 'sin dato', no $0", () => {
    const fila = filaF29PostergadoDeMes({ ...mes, monto_postergado: null }, HOY_V06);
    expect(fila!.monto).toBeNull();
    expect(fila!.monto).not.toBe(0);
    expect(fila!.motivoSinMonto).toMatch(/sin dejar el monto parseado/);
  });
});

describe("filaPreviredV06", () => {
  it("con planilla: monto real = total_cotizaciones, vencimiento día 13 del mes siguiente", () => {
    const fila = filaPreviredV06("2026-08", 612000, 9, HOY_V06);
    expect(fila.monto).toBe(612000);
    expect(fila.vencimiento).toBe("2026-09-13");
    expect(fila.motivoSinMonto).toBeNull();
    expect(fila.sub).toContain("9 trabajadores");
  });

  it("concordancia N=1: '1 trabajador', no '1 trabajadores'", () => {
    const fila = filaPreviredV06("2026-08", 68000, 1, HOY_V06);
    expect(fila.sub).toContain("1 trabajador");
    expect(fila.sub).not.toContain("1 trabajadores");
  });

  it("sin planilla del período: sin monto, con motivo", () => {
    const fila = filaPreviredV06("2026-08", null, null, HOY_V06);
    expect(fila.monto).toBeNull();
    expect(fila.motivoSinMonto).toBe("No hay planilla de BUK para este período.");
  });
});

describe("filasTgrV06", () => {
  it("sin autenticar: UNA fila honesta, nunca una tabla vacía muda", () => {
    const filas = filasTgrV06(false, undefined, HOY_V06);
    expect(filas).toHaveLength(1);
    expect(filas[0]!.estado).toBe("sin_dato");
    expect(filas[0]!.monto).toBeNull();
    expect(filas[0]!.motivoSinMonto).toMatch(/en preparación/i);
  });

  it("autenticado, sin deuda: UNA fila resuelta con monto real 0 (no un 'sin dato' disfrazado)", () => {
    const filas = filasTgrV06(true, [], HOY_V06);
    expect(filas).toHaveLength(1);
    expect(filas[0]!.estado).toBe("tgr_sin_deuda");
    expect(filas[0]!.monto).toBe(0);
    expect(filas[0]!.resuelto).toBe(true);
  });

  it("autenticado, con deuda: una fila por movimiento con saldo > 0, filtra los sin deuda", () => {
    const movimientos: TgrMovimiento[] = [
      ...tgrMovimientosV06(),
      { formulario: "29", folio: "99999", saldo: 0, estado: "pagada" },
    ];
    const filas = filasTgrV06(true, movimientos, HOY_V06);
    expect(filas).toHaveLength(2);
    expect(filas.every((f) => f.estado === "tgr_deuda")).toBe(true);
    expect(filas.map((f) => f.monto)).toEqual([430000, 95000]);
    expect(filas[0]!.label).toBe("TGR · IVA (mensual)");
    expect(filas[1]!.label).toBe("TGR · PPM");
  });
});

describe("ordenarFilasV06", () => {
  function fila(over: Partial<FilaCalendarioV06>): FilaCalendarioV06 {
    return {
      key: "x",
      concepto: "f29",
      label: "x",
      sub: "",
      estado: "declarado",
      vencimiento: null,
      vencimientoLabel: "sin fecha",
      dias: null,
      monto: null,
      motivoSinMonto: null,
      resuelto: false,
      href: null,
      hrefLabel: null,
      ...over,
    };
  }

  it("pendiente siempre antes que resuelto", () => {
    const out = ordenarFilasV06([
      fila({ key: "resuelto", resuelto: true, vencimiento: "2026-01-01" }),
      fila({ key: "pendiente", resuelto: false, dias: 5 }),
    ]);
    expect(out.map((f) => f.key)).toEqual(["pendiente", "resuelto"]);
  });

  it("entre pendientes: dias ascendente (más urgente primero), sin fecha al final", () => {
    const out = ordenarFilasV06([
      fila({ key: "sin-fecha", dias: null }),
      fila({ key: "en-20", dias: 20 }),
      fila({ key: "vencido-5", dias: -5 }),
    ]);
    expect(out.map((f) => f.key)).toEqual(["vencido-5", "en-20", "sin-fecha"]);
  });

  it("entre resueltos: vencimiento descendente (más reciente primero)", () => {
    const out = ordenarFilasV06([
      fila({ key: "viejo", resuelto: true, vencimiento: "2026-03-12" }),
      fila({ key: "nuevo", resuelto: true, vencimiento: "2026-07-12" }),
    ]);
    expect(out.map((f) => f.key)).toEqual(["nuevo", "viejo"]);
  });
});

describe("elUnicoRojoV06 — Ley 2, máximo un rojo por pantalla", () => {
  function vencido(key: string, dias: number): FilaCalendarioV06 {
    return {
      key,
      concepto: "f29",
      label: key,
      sub: "",
      estado: "no_declarado_vencido",
      vencimiento: null,
      vencimientoLabel: "s/d",
      dias,
      monto: null,
      motivoSinMonto: null,
      resuelto: false,
      href: null,
      hrefLabel: null,
    };
  }

  it("con dos vencidos, elige exactamente UNO: el más antiguo (dias más negativo)", () => {
    const key = elUnicoRojoV06([vencido("reciente", -3), vencido("viejo", -40)]);
    expect(key).toBe("viejo");
  });

  it("sin ningún vencido: null (gemelo negativo — pantalla sin rojo es válida, Ley 2)", () => {
    expect(elUnicoRojoV06([])).toBeNull();
  });

  it("declarado no cuenta como vencido (gemelo negativo del estado)", () => {
    const declarado: FilaCalendarioV06 = {
      ...vencido("d", -3),
      estado: "declarado",
    };
    expect(elUnicoRojoV06([declarado])).toBeNull();
  });
});

describe("proximoVencimientoV06", () => {
  function fila(over: Partial<FilaCalendarioV06>): FilaCalendarioV06 {
    return {
      key: "x",
      concepto: "f29",
      label: "F-29 · agosto",
      sub: "",
      estado: "en_curso",
      vencimiento: "2026-09-12",
      vencimientoLabel: "12 sep",
      dias: 10,
      monto: null,
      motivoSinMonto: null,
      resuelto: false,
      href: null,
      hrefLabel: null,
      ...over,
    };
  }

  it("elige el pendiente con menor dias (más urgente, puede ser negativo)", () => {
    const out = proximoVencimientoV06([fila({ dias: 10 }), fila({ key: "y", dias: -2 })], HOY_V06);
    expect(out?.dias).toBe(-2);
  });

  it("ignora las filas resueltas", () => {
    const out = proximoVencimientoV06([fila({ dias: -100, resuelto: true })], HOY_V06);
    expect(out).toBeNull();
  });

  it("sin ninguna fecha conocida: null (el 'no sé' de la tríada)", () => {
    expect(proximoVencimientoV06([fila({ dias: null })], HOY_V06)).toBeNull();
  });
});

describe("triadaTgrV06 — deriva de las MISMAS filas que la tabla", () => {
  it("sin autenticar: sin dato, con el motivo", () => {
    const filas = filasTgrV06(false, undefined, HOY_V06);
    const triada = triadaTgrV06(filas);
    expect(triada.total).toBeNull();
    expect(triada.motivo).toMatch(/en preparación/i);
  });

  it("con deuda: suma exacta de los montos de las filas de deuda", () => {
    const filas = filasTgrV06(true, tgrMovimientosV06(), HOY_V06);
    const triada = triadaTgrV06(filas);
    expect(triada.total).toBe(525000); // 430000 + 95000
    expect(triada.n).toBe(2);
    expect(triada.motivo).toBeNull();
  });

  it("sin deuda: total real 0, no 'sin dato'", () => {
    const filas = filasTgrV06(true, [], HOY_V06);
    const triada = triadaTgrV06(filas);
    expect(triada.total).toBe(0);
    expect(triada.motivo).toBeNull();
  });
});

describe("filasCalendarioV06 — integración con las fixtures", () => {
  it("arma una fila por mes F-29 + la del IVA postergado + Previred + TGR, pendientes primero", () => {
    const filas = filasCalendarioV06({
      mesesF29: mesesF29V06(),
      previred: { period: "2026-08", totalCotizaciones: 612000, empleados: 9 },
      tgrAutenticado: true,
      tgrMovimientos: tgrMovimientosV06(),
      hoy: HOY_V06,
    });
    // 6 meses F-29 + 1 postergado + 1 Previred + 2 TGR = 10.
    expect(filas).toHaveLength(10);
    expect(filas.map((f) => f.key)).toContain("f29-postergado-2026-04");
    expect(filas.map((f) => f.key)).toContain("previred-2026-08");

    // Pendiente siempre antes que resuelto: el flag `resuelto` nunca vuelve a `false`
    // después de haber sido `true` en el recorrido (monotonía del orden).
    let vioResuelto = false;
    for (const f of filas) {
      if (f.resuelto) vioResuelto = true;
      else expect(vioResuelto).toBe(false);
    }
  });

  it("sin período (mes futuro sin período esperado) no produce fila", () => {
    const filas = filasCalendarioV06({
      mesesF29: [
        {
          mes: 12,
          periodo: "2027-12",
          estado: "sin_periodo",
          declarado: false,
          folio: null,
          saldo: null,
          remanente: null,
          vencimiento: null,
        },
      ],
      previred: null,
      tgrAutenticado: false,
      tgrMovimientos: undefined,
      hoy: HOY_V06,
    });
    // Sin Previred (null) y TGR sin autenticar aporta su propia fila honesta (1).
    expect(filas).toHaveLength(1);
    expect(filas[0]!.concepto).toBe("tgr");
  });
});

describe("estimacionF29V06 — estimabilidad R2", () => {
  it("publica el total y desglose sólo cuando estimable=true", () => {
    const estimacion = estimacionF29V06(F29_IMPUESTO_ESTIMABLE_V06);
    expect(estimacion.monto).toBe(530000);
    expect(estimacion.desglose).toEqual({
      ivaDebito: 900000,
      ivaCredito: 500000,
      remanente: 50000,
      ppm: 130000,
      impuestoTrabajadores: 50000,
    });
    expect(estimacion.evaluadaEn).toBe("2026-08-15T12:30:00Z");
    expect(estimacion.fuentes.map((fuente) => fuente.label)).toEqual(["RCV", "BUK sincronizado"]);
  });

  it("[mutante estimable=false] se abstiene aunque el payload traiga un total plausible", () => {
    const estimacion = estimacionF29V06({
      ...F29_IMPUESTO_ESTIMABLE_V06,
      estimable: false,
    });
    expect(estimacion.monto).toBeNull();
    expect(estimacion.desglose).toBeNull();
    expect(estimacion.motivoSinMonto).toBe(F29_ESTIMADO_MOTIVO);
  });

  it("[mutante missing_inputs] se abstiene con estimable=true y montos íntegros", () => {
    const estimacion = estimacionF29V06({
      ...F29_IMPUESTO_ESTIMABLE_V06,
      missing_inputs: ["remanente"],
    });
    expect(estimacion.monto).toBeNull();
    expect(estimacion.desglose).toBeNull();
    expect(estimacion.motivoSinMonto).toContain("remanente de crédito fiscal");
  });

  it("[mutante incompleto] se abstiene con estimable=true, sin faltantes y montos íntegros", () => {
    const estimacion = estimacionF29V06({
      ...F29_IMPUESTO_ESTIMABLE_V06,
      incompleto: true,
    });
    expect(estimacion.monto).toBeNull();
    expect(estimacion.desglose).toBeNull();
    expect(estimacion.motivoSinMonto).toMatch(/incompleta/i);
  });

  it("[mutante falsos cero] no convierte los insumos ausentes en un $0", () => {
    const estimacion = estimacionF29V06({
      ...F29_IMPUESTO_NO_ESTIMABLE_V06,
      total_con_iva: 0,
      iva_debito: 0,
      iva_credito: 0,
    });
    expect(estimacion.monto).toBeNull();
    expect(estimacion.monto).not.toBe(0);
  });

  it("un cero confirmado sí se conserva cuando estimable=true y el desglose está completo", () => {
    const estimacion = estimacionF29V06({
      ...F29_IMPUESTO_ESTIMABLE_V06,
      total_con_iva: 0,
      iva_debito: 0,
      iva_credito: 0,
      remanente: 0,
      ppm: 0,
      impuesto_trabajadores: 0,
    });
    expect(estimacion.monto).toBe(0);
  });

  it("[mutante desglose nulo] se abstiene ante estimable=true inconsistente", () => {
    const estimacion = estimacionF29V06({
      ...F29_IMPUESTO_ESTIMABLE_V06,
      iva_credito: null,
    });
    expect(estimacion.monto).toBeNull();
    expect(estimacion.motivoSinMonto).toMatch(/no publicó todos los montos/i);
  });

  it("sin respuesta conserva el hueco explícito", () => {
    expect(estimacionF29V06(null).motivoSinMonto).toBe(f29EstimadoHuecoV06().reason);
  });

  it("la estimación alimenta sólo la fila del mismo período", () => {
    const estimacion = estimacionF29V06(F29_IMPUESTO_ESTIMABLE_V06);
    const filas = filasCalendarioV06({
      mesesF29: mesesF29V06(),
      estimacionF29: estimacion,
      previred: null,
      tgrAutenticado: true,
      tgrMovimientos: [],
      hoy: HOY_V06,
    });
    expect(filas.find((fila) => fila.key === "f29-2026-08")?.monto).toBe(530000);
    expect(filas.find((fila) => fila.key === "f29-2026-07")?.monto).toBeNull();
  });
});

/* `concordar` se movió a `src/lib/formatters/count.ts` (issue #94) — su cobertura genérica vive
 * en `count.test.ts`. El texto real ("1 trabajador" / "9 trabajadores") ya se fija arriba, en
 * `filaPreviredV06`. */

describe("LEY_9_TEXTO_V06 — literal, footer fijo", () => {
  it("es exactamente el texto del issue #73", () => {
    expect(LEY_9_TEXTO_V06).toBe("Las obligaciones tributarias nunca se postergan desde Qavante");
  });
});

describe("ESTADO_LABEL_V06 — cubre todos los estados", () => {
  it("no deja ningún estado sin etiqueta humana (nunca un slug crudo)", () => {
    for (const label of Object.values(ESTADO_LABEL_V06)) {
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toMatch(/_/); // ninguna etiqueta es un slug tipo "no_declarado_vencido"
    }
  });
});

describe("csvCalendarioV06", () => {
  it("cabecera + una fila por concepto, 'sin dato'/'sin fecha' en vez de vacío", () => {
    const csv = csvCalendarioV06([
      {
        key: "x",
        concepto: "f29",
        label: "F-29 · agosto 2026",
        sub: "",
        estado: "en_curso",
        vencimiento: null,
        vencimientoLabel: "sin fecha",
        dias: null,
        monto: null,
        motivoSinMonto: F29_ESTIMADO_MOTIVO,
        resuelto: false,
        href: null,
        hrefLabel: null,
      },
    ]);
    const filas = csv.split("\n");
    expect(filas[0]).toBe("concepto;estado;vencimiento;dias;monto");
    expect(filas[1]).toBe("F-29 · agosto 2026;En curso;sin fecha;sin fecha;sin dato");
  });
});
