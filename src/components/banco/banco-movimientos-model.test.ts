import { describe, it, expect } from "vitest";
import type { BankMovement, TarjetaMovimiento } from "@/lib/api/treasury";
import {
  bankAccountIdDeCuenta,
  movimientosDeCuenta,
  mesDeFecha,
  movimientosDeTarjeta,
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
    bm({ id: "a", bank_account_id: "acc-1", date: "2026-08-01", amount: "-5000", description: "PAGO" }),
    bm({ id: "b", bank_account_id: "acc-2", date: "2026-08-03", amount: "-9000" }), // otra cuenta → fuera
    bm({ id: "c", bank_account_id: "acc-1", date: "2026-08-04", amount: "12000", direction: "credit" }),
    // amount en absoluto + direction debit → se firma negativo
    bm({ id: "d", bank_account_id: "acc-1", date: "2026-08-02", amount: "3000", direction: "debit" }),
  ];
  it("filtra por bank_account_id, firma el monto (egreso negativo) y ordena por fecha desc", () => {
    const r = movimientosDeCuenta(items, "acc-1", "CLP");
    expect(r.map((m) => m.glosa === "" || m.fecha)).toEqual(["2026-08-04", "2026-08-02", "2026-08-01"]);
    const byId = Object.fromEntries(r.map((m) => [m.fecha, m.monto]));
    expect(byId["2026-08-04"]).toBe(12_000); // ingreso
    expect(byId["2026-08-02"]).toBe(-3_000); // abs + debit → negativo
    expect(byId["2026-08-01"]).toBe(-5_000);
  });
  it("sin bankAccountId → [] (no muestra toda la cartola)", () => {
    expect(movimientosDeCuenta(items, null, "CLP")).toEqual([]);
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
  ({ date: "2026-08-05", type: "compra", description: "X", amount: "10000", currency: "CLP", state: "ok", installmentsDescription: null, ...over }) as TarjetaMovimiento;

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
