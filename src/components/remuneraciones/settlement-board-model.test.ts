import { describe, it, expect } from "vitest";
import type { BankMovement } from "@/lib/api/treasury";
import {
  normalizeBoard,
  workerPendiente,
  periodToYyyymm,
  debitosCandidatos,
  buildReconcileBody,
  type SettlementBoard,
} from "./settlement-board-model";

const RAW_BOARD = {
  period_outstanding: "1000000",
  workers: [
    {
      worker_rut: "20.009.075-6",
      worker_name: "Carrasco",
      liquido: "1000000",
      paid_amount: "0",
      outstanding: "1000000",
      status: "pendiente",
    },
    {
      worker_rut: "12.345.678-9",
      worker_name: "Ana Pérez",
      liquido: "500000",
      paid_amount: "500000",
      outstanding: "0",
      status: "conciliado",
    },
  ],
  links: [
    {
      link_id: "lnk_1",
      worker_rut: "12.345.678-9",
      worker_name: "Ana Pérez",
      amount: "500000",
      bank_movement_id: "bm_ana",
      glosa: "TRANSF SUELDO ANA",
      created_at: "2026-07-31T10:00:00Z",
    },
  ],
};

describe("normalizeBoard", () => {
  it("mapea trabajadores, links y saldo (montos string Decimal → number)", () => {
    const b = normalizeBoard(RAW_BOARD);
    expect(b.periodOutstanding).toBe(1_000_000);
    expect(b.workers).toHaveLength(2);
    expect(b.workers[0]).toMatchObject({ workerRut: "20.009.075-6", outstanding: 1_000_000 });
    expect(b.links[0]).toMatchObject({
      linkId: "lnk_1",
      bankMovementId: "bm_ana",
      amount: 500_000,
    });
  });

  it("es defensivo con board vacío / campos ausentes", () => {
    expect(normalizeBoard(undefined)).toEqual<SettlementBoard>({
      workers: [],
      periodOutstanding: 0,
      links: [],
    });
    expect(normalizeBoard({ workers: null, links: "nope" })).toEqual<SettlementBoard>({
      workers: [],
      periodOutstanding: 0,
      links: [],
    });
  });
});

describe("workerPendiente", () => {
  const b = normalizeBoard(RAW_BOARD);
  it("pendiente si outstanding > tolerancia", () => {
    expect(workerPendiente(b.workers[0]!)).toBe(true); // Carrasco 1M
    expect(workerPendiente(b.workers[1]!)).toBe(false); // Ana 0
  });
  it("trata centavos de redondeo como conciliado", () => {
    expect(workerPendiente({ ...b.workers[0]!, outstanding: 1 })).toBe(false);
    expect(workerPendiente({ ...b.workers[0]!, outstanding: 2 })).toBe(true);
  });
});

describe("periodToYyyymm", () => {
  it("YYYY-MM → YYYYMM", () => {
    expect(periodToYyyymm("2026-07")).toBe("202607");
    expect(periodToYyyymm("2026-07-15")).toBe("202607");
  });
});

const bm = (over: Partial<BankMovement>): BankMovement =>
  ({
    id: "bm_x",
    bank_account_id: "acc",
    external_id: "ext",
    date: "2026-07-30",
    description: "PAGO SUELDO",
    amount: "-1000000",
    direction: "debit",
    canonical_category: "payroll_payment",
    management_account_id: null,
    reconciliation_status: "unreconciled",
    match_score: null,
    matched_document_id: null,
    data_status: "ok",
    imported_at: "2026-07-30T00:00:00Z",
    classified_at: null,
    classified_by: null,
    notes: null,
    classification_status: "classified",
    confidence: null,
    classification_notes: null,
    ...over,
  }) as BankMovement;

describe("debitosCandidatos", () => {
  // board: Carrasco pendiente ($1.000.000), Ana conciliada ($0). montosPendientes = {1000000}.
  const board = normalizeBoard(RAW_BOARD);
  it("incluye payroll por categoría/glosa; excluye créditos, no-payroll sin calce y ya-asignados", () => {
    const items = [
      bm({ id: "bm_1", description: "SUELDO CARRASCO", amount: "-1000000" }), // payroll (glosa/cat)
      bm({ id: "bm_credito", direction: "credit", amount: "1000000" }), // ingreso → fuera
      // No payroll (categoría + glosa) y monto que NO calza con ningún pendiente → fuera.
      bm({
        id: "bm_prov",
        canonical_category: "supplier_payment",
        description: "PAGO PROVEEDOR ACME",
        amount: "-777777",
      }),
      bm({ id: "bm_ana", amount: "-1000000" }), // ya asignado (link) → fuera aunque calce
    ];
    const cands = debitosCandidatos(items, board);
    expect(cands.map((c) => c.id)).toEqual(["bm_1"]);
  });

  it("incluye un débito SIN categoría payroll si el monto CALZA el líquido de un pendiente (transf. real)", () => {
    // Caso real Tooxs: sueldos salen como "Transf. a terceros" sin categoría, por el monto exacto.
    const items = [
      bm({
        id: "bm_transf",
        canonical_category: null,
        description: "Transf. a terceros vía Internet a cuenta 2002",
        amount: "-1000000", // = outstanding de Carrasco
      }),
    ];
    expect(debitosCandidatos(items, board).map((c) => c.id)).toEqual(["bm_transf"]);
  });

  it("incluye la nómina en lote por la glosa aunque no calce un monto individual", () => {
    const items = [
      bm({
        id: "bm_batch",
        canonical_category: null,
        description: "Cargo nómina en línea (Rem julio)",
        amount: "-8081518", // no calza ningún trabajador individual, pero la glosa dice nómina
      }),
    ];
    expect(debitosCandidatos(items, board).map((c) => c.id)).toEqual(["bm_batch"]);
  });

  it("ordena por fecha desc", () => {
    const items = [
      bm({ id: "a", date: "2026-07-01" }),
      bm({ id: "b", date: "2026-07-28" }),
      bm({ id: "c", date: "2026-07-15" }),
    ];
    expect(debitosCandidatos(items, board).map((c) => c.id)).toEqual(["b", "c", "a"]);
  });
});

describe("buildReconcileBody", () => {
  it("arma el cuerpo con YYYYMM, monto del débito y worker_ruts manuales", () => {
    const debito = { id: "bm_1", date: "2026-07-30", glosa: "x", monto: 1_000_000 };
    expect(buildReconcileBody("2026-07", debito, ["20.009.075-6"], true)).toEqual({
      period: "202607",
      amount: 1_000_000,
      bank_movement_id: "bm_1",
      worker_ruts: ["20.009.075-6"],
      dry_run: true,
    });
  });
});
