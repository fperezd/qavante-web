import { describe, it, expect } from "vitest";
import type { BankMovement, TarjetaMovimiento } from "@/lib/api/treasury";
import {
  bankAccountIdDeCuenta,
  movimientosDeCuenta,
  mesDeFecha,
  movimientosDeTarjeta,
  estadoConciliacion,
  estadoClasificacion,
  filtrarMovimientos,
  contarMovimientos,
  mapaSugerencias,
  type MovimientoBanco,
} from "./banco-movimientos-model";

const bm = (over: Partial<BankMovement>): BankMovement =>
  ({
    id: "bm",
    bank_account_id: "acc-1",
    external_id: "e",
    date: "2026-08-05",
    description: "MOV",
    amount: "-1000",
    direction: "debit",
    canonical_category: null,
    management_account_id: null,
    reconciliation_status: "unreconciled",
    match_score: null,
    matched_document_id: null,
    data_status: "ok",
    imported_at: "2026-08-05T00:00:00Z",
    classified_at: null,
    classified_by: null,
    notes: null,
    classification_status: "classified",
    confidence: null,
    classification_notes: null,
    ...over,
  }) as BankMovement;

describe("bankAccountIdDeCuenta", () => {
  const accts = [
    { external_id: "07-04222-1", linked_bank_account_id: "80771901" },
    { external_id: "013-07-02990-8", linked_bank_account_id: "523a5dc1" },
  ];
  it("mapea numeroFormateado → linked_bank_account_id", () => {
    expect(bankAccountIdDeCuenta(accts, "07-04222-1")).toBe("80771901");
    expect(bankAccountIdDeCuenta(accts, "013-07-02990-8")).toBe("523a5dc1");
  });
  it("null si no matchea / sin número / lista vacía", () => {
    expect(bankAccountIdDeCuenta(accts, "99-99")).toBeNull();
    expect(bankAccountIdDeCuenta(accts, null)).toBeNull();
    expect(bankAccountIdDeCuenta(undefined, "07-04222-1")).toBeNull();
  });
});

describe("movimientosDeCuenta", () => {
  const items = [
    bm({
      id: "a",
      bank_account_id: "acc-1",
      date: "2026-08-01",
      amount: "-5000",
      description: "PAGO",
    }),
    bm({ id: "b", bank_account_id: "acc-2", date: "2026-08-03", amount: "-9000" }), // otra cuenta → fuera
    bm({
      id: "c",
      bank_account_id: "acc-1",
      date: "2026-08-04",
      amount: "12000",
      direction: "credit",
    }),
    // amount en absoluto + direction debit → se firma negativo
    bm({
      id: "d",
      bank_account_id: "acc-1",
      date: "2026-08-02",
      amount: "3000",
      direction: "debit",
    }),
  ];
  it("filtra por bank_account_id, firma el monto (egreso negativo) y ordena por fecha desc", () => {
    const r = movimientosDeCuenta(items, "acc-1");
    expect(r.map((m) => m.glosa === "" || m.fecha)).toEqual([
      "2026-08-04",
      "2026-08-02",
      "2026-08-01",
    ]);
    const byId = Object.fromEntries(r.map((m) => [m.fecha, m.monto]));
    expect(byId["2026-08-04"]).toBe(12_000); // ingreso
    expect(byId["2026-08-02"]).toBe(-3_000); // abs + debit → negativo
    expect(byId["2026-08-01"]).toBe(-5_000);
  });
  it("marca esAbono (ingreso) y el estado de conciliación", () => {
    const r = movimientosDeCuenta(
      [
        bm({
          id: "ab",
          bank_account_id: "acc-1",
          amount: "50000",
          direction: "credit",
          reconciliation_status: "matched",
        }),
        bm({
          id: "ca",
          bank_account_id: "acc-1",
          amount: "-9000",
          reconciliation_status: "unreconciled",
        }),
      ],
      "acc-1",
    );
    const ab = r.find((m) => m.id === "ab")!;
    const ca = r.find((m) => m.id === "ca")!;
    expect(ab.esAbono).toBe(true);
    expect(ab.estado).toBe("conciliado");
    expect(ab.estadoClasificacion).toBe("por_clasificar");
    expect(ca.esAbono).toBe(false);
    expect(ca.estado).toBe("por_conciliar");
  });

  it("sin bankAccountId → [] (no muestra toda la cartola)", () => {
    expect(movimientosDeCuenta(items, null)).toEqual([]);
  });

  it("preserva la moneda por fila y deja S/D cuando la API no trae evidencia", () => {
    const r = movimientosDeCuenta(
      [
        bm({ id: "usd", bank_account_id: "acc-1", currency_code: "usd" }),
        bm({ id: "unknown", bank_account_id: "acc-1", currency_code: null }),
      ],
      "acc-1",
    );

    expect(r.find((m) => m.id === "usd")?.moneda).toBe("USD");
    expect(r.find((m) => m.id === "unknown")?.moneda).toBe("S/D");
  });
});

describe("estadoConciliacion", () => {
  it("mapea el reconciliation_status", () => {
    expect(estadoConciliacion("unreconciled")).toBe("por_conciliar");
    expect(estadoConciliacion("unmatched")).toBe("por_conciliar");
    expect(estadoConciliacion("")).toBe("por_conciliar");
    expect(estadoConciliacion("matched")).toBe("conciliado");
    expect(estadoConciliacion("reconciled")).toBe("conciliado");
    expect(estadoConciliacion("partial")).toBe("parcial");
    expect(estadoConciliacion("not_required")).toBe("no_requerido");
    expect(estadoConciliacion("excluded")).toBe("excluido");
    expect(estadoConciliacion("unexpected_status")).toBe("por_conciliar");
  });
});

describe("estadoClasificacion", () => {
  it("exige estado classified y un destino real", () => {
    expect(
      estadoClasificacion(
        bm({ classification_status: "classified", canonical_category: "supplier_payment" }),
      ),
    ).toBe("clasificado");
    expect(
      estadoClasificacion(
        bm({
          classification_status: "classified",
          canonical_category: null,
          management_account_id: null,
        }),
      ),
    ).toBe("por_clasificar");
    expect(estadoClasificacion(bm({ classification_status: "needs_review" }))).toBe("revision");
  });
});

describe("filtrarMovimientos / contarMovimientos", () => {
  const movs: MovimientoBanco[] = [
    {
      id: "1",
      fecha: "2026-08-04",
      glosa: "TRANSF SUELDO",
      monto: 500000,
      moneda: "CLP",
      esAbono: true,
      estado: "conciliado",
    },
    {
      id: "2",
      fecha: "2026-08-03",
      glosa: "PAGO TGR",
      monto: -1000000,
      moneda: "CLP",
      esAbono: false,
      estado: "por_conciliar",
    },
    {
      id: "3",
      fecha: "2026-08-02",
      glosa: "PAGO PROVEEDOR",
      monto: -50000,
      moneda: "CLP",
      esAbono: false,
      estado: "conciliado",
    },
  ];
  it("cuenta abonos/cargos/por-conciliar (sin sugerencias → 0)", () => {
    expect(contarMovimientos(movs)).toEqual({
      abonos: 1,
      cargos: 2,
      porConciliar: 1,
      sugerencias: 0,
      porClasificar: 0,
    });
  });
  it("cuenta sugerencias = intersección con los ids con match propuesto", () => {
    expect(contarMovimientos(movs, new Set(["2"])).sugerencias).toBe(1);
    expect(contarMovimientos(movs, new Set(["2", "3", "no-existe"])).sugerencias).toBe(2);
  });
  it("filtra por tab", () => {
    expect(filtrarMovimientos(movs, "abonos", "").map((m) => m.id)).toEqual(["1"]);
    expect(filtrarMovimientos(movs, "cargos", "").map((m) => m.id)).toEqual(["2", "3"]);
    expect(filtrarMovimientos(movs, "por_conciliar", "").map((m) => m.id)).toEqual(["2"]);
    expect(filtrarMovimientos(movs, "todos", "").length).toBe(3);
  });
  it("tab 'sugerencias' deja solo los ids con match propuesto", () => {
    expect(filtrarMovimientos(movs, "sugerencias", "", new Set(["2"])).map((m) => m.id)).toEqual([
      "2",
    ]);
    // Sin el set (o vacío) el tab no muestra nada (no hay sugerencias que cruzar).
    expect(filtrarMovimientos(movs, "sugerencias", "")).toEqual([]);
  });
  it("filtra por texto en la glosa (case-insensitive), combinado con el tab", () => {
    expect(filtrarMovimientos(movs, "todos", "pago").map((m) => m.id)).toEqual(["2", "3"]);
    expect(filtrarMovimientos(movs, "cargos", "tgr").map((m) => m.id)).toEqual(["2"]);
  });
});

describe("mapaSugerencias", () => {
  it("indexa por movement_id, parsea score y respeta document_count", () => {
    const map = mapaSugerencias([
      {
        movement_id: "m1",
        date: "2026-08-31",
        amount: "1250000",
        direction: "credit",
        currency_code: "USD",
        description: "Cobro canónico API",
        suggestion: {
          document_kind: "receivable",
          name: "Kaufmann",
          score: "60",
          document_count: 1,
          topology: "1:1",
          reasons: ["RUT en glosa", "monto exacto"],
          can_confirm: true,
          bulk_eligible: true,
          documents: [
            {
              document_id: "doc-1",
              kind: "receivable",
              document_type: 33,
              folio: "435",
              rut: "76123456-7",
              name: "Kaufmann",
              amount: "1250000",
              date: "2026-08-20",
              source_provider: "sii_rcv",
            },
          ],
        },
      },
      {
        movement_id: "m2",
        date: "2026-08-30",
        amount: "100",
        direction: "debit",
        currency_code: "CLP",
        description: "Snapshot con respaldos incompletos",
        suggestion: {
          document_kind: "payable",
          name: "Remuneraciones",
          score: "80",
          document_count: 3,
          topology: "1:N",
          can_confirm: true,
          bulk_eligible: true,
        },
      },
    ]);
    expect(map.get("m1")).toMatchObject({
      kind: "receivable",
      nombre: "Kaufmann",
      score: 60,
      documentCount: 1,
      topology: "1:1",
      canConfirm: true,
      bulkEligible: true,
      movimiento: {
        fecha: "2026-08-31",
        monto: 1250000,
        direccion: "credit",
        moneda: "USD",
        glosa: "Cobro canónico API",
        completo: true,
      },
    });
    expect(map.get("m1")?.documents[0]).toMatchObject({
      folio: "435",
      monto: 1250000,
      nombre: "Kaufmann",
    });
    expect(map.get("m2")).toMatchObject({
      kind: "payable",
      documentCount: null,
      topology: null,
      canConfirm: false,
      bulkEligible: false,
      movimiento: expect.objectContaining({ completo: true }),
    });
  });
  it("score null/'' → null; sin movement_id → se ignora", () => {
    const map = mapaSugerencias([
      {
        movement_id: "m3",
        date: "2026-08-30",
        amount: "100",
        suggestion: {
          document_kind: "payable",
          name: null,
          score: null,
          document_count: 1,
          topology: "1:1",
          can_confirm: true,
          bulk_eligible: true,
        },
      },
      {
        movement_id: "",
        date: "2026-08-30",
        amount: "100",
        suggestion: {
          document_kind: "receivable",
          name: "X",
          score: "90",
          document_count: 1,
          topology: "1:1",
          can_confirm: true,
          bulk_eligible: true,
        },
      },
    ]);
    expect(map.get("m3")).toMatchObject({
      nombre: null,
      score: null,
      documentCount: null,
      topology: null,
      canConfirm: false,
      bulkEligible: false,
    });
    expect(map.has("")).toBe(false);
    expect(map.size).toBe(1);
  });
  it("oculta topología y bloquea acciones si document_count no calza con los respaldos", () => {
    const suggestion = mapaSugerencias([
      {
        movement_id: "m5",
        date: "2026-08-30",
        amount: "100",
        direction: "credit",
        currency_code: "CLP",
        description: "Cobro con un respaldo faltante",
        suggestion: {
          document_kind: "receivable",
          document_count: 2,
          topology: "1:N",
          can_confirm: true,
          bulk_eligible: true,
          documents: [
            {
              document_id: "doc-1",
              kind: "receivable",
              amount: "100",
            },
          ],
        },
      },
    ]).get("m5");

    expect(suggestion).toMatchObject({
      documentCount: null,
      topology: null,
      canConfirm: false,
      bulkEligible: false,
    });
    expect(suggestion?.documents).toHaveLength(1);
  });
  it("undefined → mapa vacío", () => {
    expect(mapaSugerencias(undefined).size).toBe(0);
  });
});

describe("mesDeFecha", () => {
  it("ISO / DD-MM-YYYY / DD/MM/YYYY", () => {
    expect(mesDeFecha("2026-08-05")).toBe("2026-08");
    expect(mesDeFecha("2026-08-05T12:00:00Z")).toBe("2026-08");
    expect(mesDeFecha("05/08/2026")).toBe("2026-08");
    expect(mesDeFecha("05-08-2026")).toBe("2026-08");
  });
  it("null si no se puede inferir", () => {
    expect(mesDeFecha("agosto 2026")).toBeNull();
    expect(mesDeFecha(null)).toBeNull();
  });
});

const tm = (over: Partial<TarjetaMovimiento>): TarjetaMovimiento =>
  ({
    date: "2026-08-05",
    type: "compra",
    description: "X",
    amount: "10000",
    currency: "CLP",
    state: "ok",
    installmentsDescription: null,
    ...over,
  }) as TarjetaMovimiento;

describe("movimientosDeTarjeta", () => {
  it("filtra por mes; deja pasar los de fecha no parseable; ordena desc", () => {
    const movs = [
      tm({ date: "2026-08-10", description: "AGO" }),
      tm({ date: "2026-07-20", description: "JUL" }), // otro mes → fuera
      tm({ date: "raro", description: "SIN FECHA" }), // no parseable → incluido
      tm({ date: "2026-08-02", description: "AGO2", installmentsDescription: "03/06" }),
    ];
    const r = movimientosDeTarjeta(movs, "2026-08");
    expect(r.map((m) => m.glosa)).toEqual(["SIN FECHA", "AGO", "AGO2"]); // "raro" > "2026-.." en string desc
    expect(r.find((m) => m.glosa === "AGO2")?.cuotas).toBe("03/06");
  });
});
