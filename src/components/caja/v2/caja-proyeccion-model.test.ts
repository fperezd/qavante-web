import { describe, it, expect } from "vitest";
import {
  movimientosDeMaestro,
  movimientosDeObligaciones,
  proyeccionDeMovimientos,
  hayProyeccion,
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

const cpM = (docs: DocMaestro[], name = "Cliente X"): ContraparteMaestro => ({
  rut: "77111222-3",
  name,
  docCount: docs.length,
  total: 0,
  vencido: 0,
  porVencer: 0,
  vigente: 0,
  pagado: 0,
  termino: 30,
  terminoCustom: false,
  proximoVencimiento: null,
  docs,
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
  it("un movimiento por doc no pagado; la NC netea (monto opuesto); salta pagados y sin fecha", () => {
    const cp = cpM([
      docM({ folio: 1, monto: 1_000_000 }),
      docM({ folio: 2, monto: -300_000, esNotaCredito: true }), // NC
      docM({ folio: 3, monto: 500_000, pagado: true }), // pagado → fuera
      docM({ folio: 4, monto: 500_000, vencimiento: null }), // sin fecha → fuera
    ]);
    const movs = movimientosDeMaestro([cp], 1, "cobranza", HOY, 120);
    expect(movs.map((m) => m.monto)).toEqual([1_000_000, -300_000]); // factura + NC (netea)
    expect(movs[0]?.tipo).toBe("cobranza");
    expect(movs[0]?.label).toBe("Cliente X");
  });

  it("signo −1 invierte (pagos: factura sale, NC suma)", () => {
    const cp = cpM([
      docM({ monto: 1_000_000 }),
      docM({ folio: 2, monto: -200_000, esNotaCredito: true }),
    ]);
    const movs = movimientosDeMaestro([cp], -1, "proveedor", HOY, 120);
    expect(movs.map((m) => m.monto)).toEqual([-1_000_000, 200_000]);
  });

  it("past-due (vencido, impago) → fecha efectiva = hoy (día 0)", () => {
    const cp = cpM([docM({ vencimiento: new Date(2026, 5, 1) })]); // 1-jun, ya venció
    const movs = movimientosDeMaestro([cp], 1, "cobranza", HOY, 120);
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
