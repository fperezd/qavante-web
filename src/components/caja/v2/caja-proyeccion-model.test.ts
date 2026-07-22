import { describe, it, expect } from "vitest";
import {
  movimientosDeMaestro,
  movimientosDeObligaciones,
  proyeccionDeMovimientos,
  hayProyeccion,
  movimientosPorSemana,
  fechaCortaLabel,
} from "./caja-proyeccion-model";
import type { ContraparteMaestro, DocMaestro } from "@/components/terminos/terminos-pago";
import type { MovimientoCaja } from "./caja-cascada-model";
import type { PayableItem } from "@/lib/api/pagos";

const HOY = new Date(2026, 6, 21); // 21-jul-2026

const docM = (over: Partial<DocMaestro>): DocMaestro => ({
  folio: 1,
  fecha: "01/07/2026",
  fechaEmision: new Date(2026, 6, 1),
  monto: 1_000_000,
  vencimiento: new Date(2026, 7, 1), // 1-ago
  estado: "vigente",
  diasParaVencer: 11,
  pagado: false,
  tipoDoc: 33,
  esNotaCredito: false,
  refFolio: null,
  anulacion: null,
  neto: null,
  ...over,
});

const cpM = (docs: DocMaestro[], over: Partial<ContraparteMaestro> = {}): ContraparteMaestro => ({
  rut: "77111222-3",
  name: "Cliente X",
  docCount: docs.length,
  total: docs.reduce((s, d) => s + d.monto, 0), // net de NC (montos ya signados); buildMaestro lo calcula
  vencido: 0,
  porVencer: 0,
  vigente: 0,
  pagado: 0,
  termino: 30,
  terminoCustom: false,
  proximoVencimiento: null,
  docs,
  ...over,
});

const item = (over: Partial<PayableItem>): PayableItem =>
  ({
    label: "X",
    category: "tax",
    due_date: "2026-08-05",
    amount: "1000000",
    criticality: "medium",
    source: "SII",
    ...over,
  }) as PayableItem;

describe("movimientosDeMaestro", () => {
  it("UN movimiento por contraparte = neto pendiente (NC ya neteada en total)", () => {
    const cp = cpM([
      docM({ folio: 1, monto: 1_000_000 }),
      docM({ folio: 2, monto: -300_000, esNotaCredito: true }), // NC → ya restada en total
    ]); // total = 700_000
    const movs = movimientosDeMaestro([cp], 1, "cobranza", HOY, 120);
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({ monto: 700_000, tipo: "cobranza", label: "Cliente X" });
  });

  it("signo −1 invierte (pago sale por el neto)", () => {
    const cp = cpM([
      docM({ monto: 1_000_000 }),
      docM({ folio: 2, monto: -200_000, esNotaCredito: true }),
    ]); // total 800_000
    const movs = movimientosDeMaestro([cp], -1, "proveedor", HOY, 120);
    expect(movs.map((m) => m.monto)).toEqual([-800_000]);
  });

  it("neto ≤ 0 (NC ≥ facturas, ej NC de compra huérfana) → SIN movimiento fantasma", () => {
    // Caso real Tooxs: TD Synnex tenía NC de compra > facturas → antes emitía +$26,8M de ingreso falso.
    const cp = cpM([docM({ monto: -500_000, esNotaCredito: true })], { total: -500_000 });
    expect(movimientosDeMaestro([cp], -1, "proveedor", HOY, 120)).toHaveLength(0);
  });

  it("pagado (conciliado) descuenta del neto → si el neto queda 0, no proyecta", () => {
    const cp = cpM([docM({ monto: 1_000_000 })], { total: 1_000_000, pagado: 1_000_000 });
    expect(movimientosDeMaestro([cp], 1, "cobranza", HOY, 120)).toHaveLength(0);
  });

  it("coloca el neto en el vencimiento MÁS TEMPRANO de sus docs en la ventana", () => {
    const cp = cpM([
      docM({ folio: 1, monto: 600_000, vencimiento: new Date(2026, 7, 10) }), // 10-ago
      docM({ folio: 2, monto: 400_000, vencimiento: new Date(2026, 6, 25) }), // 25-jul (más temprano)
    ]); // total 1_000_000
    const movs = movimientosDeMaestro([cp], 1, "cobranza", HOY, 120);
    expect(movs).toHaveLength(1);
    expect(movs[0]?.monto).toBe(1_000_000);
    expect(movs[0]?.fecha.getTime()).toBe(new Date(2026, 6, 25).getTime());
  });

  it("la NC no aporta su fecha: si solo un doc no-NC en ventana define el vencimiento", () => {
    const cp = cpM([
      docM({ folio: 1, monto: 1_000_000, vencimiento: new Date(2026, 7, 1) }), // factura 1-ago
      docM({ folio: 2, monto: -300_000, esNotaCredito: true, vencimiento: new Date(2026, 6, 22) }),
    ]); // total 700_000; la NC vence antes pero NO cuenta como fecha
    const movs = movimientosDeMaestro([cp], 1, "cobranza", HOY, 120);
    expect(movs).toHaveLength(1);
    expect(movs[0]?.fecha.getTime()).toBe(new Date(2026, 7, 1).getTime());
  });

  it("past-due más viejo que la gracia → EXCLUIDO (default grace 0; ya pagado, ya en cash_today)", () => {
    const cp = cpM([docM({ vencimiento: new Date(2026, 5, 1) })]); // 1-jun, ~50d vencido
    expect(movimientosDeMaestro([cp], 1, "cobranza", HOY, 120)).toHaveLength(0);
  });

  it("past-due DENTRO de la gracia → incluido, fecha efectiva = hoy", () => {
    const cp = cpM([docM({ vencimiento: new Date(2026, 6, 18) })]); // 18-jul, 3d vencido
    const movs = movimientosDeMaestro([cp], 1, "cobranza", HOY, 120, 7); // grace 7d
    expect(movs).toHaveLength(1);
    expect(movs[0]?.fecha.getTime()).toBe(HOY.getTime());
  });

  it("fuera del horizonte → excluido", () => {
    const cp = cpM([docM({ vencimiento: new Date(2026, 11, 1) })]); // 1-dic (>120d)
    expect(movimientosDeMaestro([cp], 1, "cobranza", HOY, 120)).toHaveLength(0);
  });
});

describe("movimientosDeObligaciones", () => {
  it("cada item con due_date → pago (outflow) con su tipo; salta sin fecha", () => {
    const movs = movimientosDeObligaciones(
      [
        item({ label: "IVA F29", category: "tax", amount: "1800000", due_date: "2026-08-05" }),
        item({ label: "Sueldos", category: "payroll", amount: "4200000", due_date: "2026-07-30" }),
        item({ label: "sin fecha", due_date: undefined as unknown as string }),
      ],
      HOY,
      120,
    );
    expect(movs.map((m) => [m.label, m.monto, m.tipo])).toEqual([
      ["IVA F29", -1_800_000, "impuesto"],
      ["Sueldos", -4_200_000, "sueldos"],
    ]);
  });

  it("obligación past-due vieja → excluida (default grace 0; ya pagada)", () => {
    expect(movimientosDeObligaciones([item({ due_date: "2026-05-01" })], HOY, 120)).toHaveLength(0);
  });
});

describe("proyeccionDeMovimientos", () => {
  const mov = (dia: number, monto: number): MovimientoCaja => ({
    fecha: new Date(2026, 6, 21 + dia),
    fechaLabel: `+${dia}`,
    label: "m",
    monto,
  });

  it("cruza $0 en la fecha real del movimiento (no índice); piso + recuperación", () => {
    const m = proyeccionDeMovimientos(
      5_000_000,
      [mov(10, -6_000_000), mov(20, 8_000_000)],
      HOY,
      null,
    )!;
    expect(m.diasHastaCero).toBe(10); // 5M − 6M = −1M al día 10
    expect(m.diasHastaMinimo).toBe(10); // ref = $0
    expect(m.piso).toEqual({ saldo: -1_000_000, dia: 10 });
    expect(m.diasRecuperacion).toBe(20); // vuelve ≥0 al día 20 (7M)
    expect(m.estado).toBe("critico");
    expect(m.horizonteDias).toBe(20);
  });

  it("saldo hoy ya negativo → critico, 0 días", () => {
    const m = proyeccionDeMovimientos(-2_000_000, [mov(10, 1_000_000)], HOY, null)!;
    expect(m.estado).toBe("critico");
    expect(m.diasHastaCero).toBe(0);
    expect(m.saldoHoy).toBe(-2_000_000);
  });

  it("nunca cruza → sano", () => {
    const m = proyeccionDeMovimientos(
      10_000_000,
      [mov(10, 2_000_000), mov(20, -1_000_000)],
      HOY,
      null,
    )!;
    expect(m.estado).toBe("sano");
    expect(m.diasHastaMinimo).toBeNull();
  });

  it("con mínima: cae bajo la mínima sin tocar $0 → ajustado", () => {
    const m = proyeccionDeMovimientos(5_000_000, [mov(5, -3_000_000)], HOY, 3_000_000)!; // 2M < 3M, > 0
    expect(m.estado).toBe("ajustado");
    expect(m.diasHastaMinimo).toBe(5);
    expect(m.diasHastaCero).toBeNull();
  });

  it("sin movimientos → null", () => {
    expect(proyeccionDeMovimientos(1_000_000, [], HOY, null)).toBeNull();
  });
});

describe("hayProyeccion", () => {
  it("false sin movimientos, true con ≥1", () => {
    expect(hayProyeccion([])).toBe(false);
    expect(hayProyeccion([{ fecha: HOY, fechaLabel: "hoy", label: "m", monto: 1 }])).toBe(true);
  });
});

describe("fechaCortaLabel", () => {
  it("formatea DD-mmm", () => {
    expect(fechaCortaLabel(new Date(2026, 6, 14))).toBe("14-jul");
  });
});

describe("movimientosPorSemana", () => {
  const mov = (dia: number, monto: number): MovimientoCaja => ({
    fecha: new Date(2026, 6, 21 + dia),
    fechaLabel: `+${dia}`,
    label: "m",
    monto,
  });

  it("suma el neto por bucket de 7 días desde hoy; ordena; etiqueta con RANGO de semana", () => {
    // día 0 y 3 → semana 0; día 8 → semana 1
    const out = movimientosPorSemana(
      [mov(0, 1_000_000), mov(3, -400_000), mov(8, -2_000_000)],
      HOY,
    );
    expect(out).toHaveLength(2);
    // HOY = 21-jul: semana 0 = 21–27 jul; semana 1 = 28 jul–3 ago (cruza mes)
    expect(out[0]).toMatchObject({
      label: "Esta semana",
      monto: 600_000,
      tipo: "cobranza",
      fechaLabel: "21–27 jul",
    });
    expect(out[1]).toMatchObject({
      label: "Sem +1",
      monto: -2_000_000,
      tipo: "otro",
      fechaLabel: "28 jul–3 ago",
    });
  });

  it("vacío → vacío", () => {
    expect(movimientosPorSemana([], HOY)).toEqual([]);
  });
});
