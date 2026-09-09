import { describe, expect, it } from "vitest";
import {
  allocationLabel,
  assignmentConfirmation,
  revertConfirmation,
} from "./document-resolution-drawer";

describe("DocumentResolutionDrawer", () => {
  it("exige confirmación explícita para una asignación individual", () => {
    expect(assignmentConfirmation(1)).toContain("¿Asignar");
    expect(assignmentConfirmation(1)).toContain("movimiento bancario");
  });

  it("explica que un pago consolidado aplicará todo el conjunto", () => {
    const copy = assignmentConfirmation([
      {
        document_kind: "payable",
        document_id: "doc-1",
        source_external_id: "33-100-76111111-1",
        amount: "120000",
        name: "Cliente Uno",
      },
      {
        document_kind: "payable",
        document_id: "doc-2",
        source_external_id: "33-101-76111111-1",
        amount: "80000",
        name: "Cliente Uno",
      },
    ]);
    expect(copy).toContain("2 documentos");
    expect(copy).toContain("conjunto completo");
    expect(copy).toContain("33-100-76111111-1 · Cliente Uno: 120.000");
    expect(copy).toContain("33-101-76111111-1 · Cliente Uno: 80.000");
  });

  it("formatea las asignaciones con la moneda compartida sin asumir CLP", () => {
    const allocation = {
      document_kind: "receivable",
      document_id: "doc-usd",
      source_external_id: "33-200-76111111-1",
      amount: "1234.5",
      name: "Cliente USD",
    };

    expect(allocationLabel(allocation, "CLP")).toContain("$1.235");
    expect(allocationLabel(allocation, "USD")).toContain("US$ 1.234,50");
  });

  it("enumera todos los documentos que una reversión consolidada reabrirá", () => {
    const copy = revertConfirmation([
      {
        document_kind: "receivable",
        document_id: "doc-1",
        source_external_id: "33-9-76111111-1",
        amount: "50000",
        name: "Cliente Uno",
      },
      {
        document_kind: "receivable",
        document_id: "doc-2",
        source_external_id: "33-10-76111111-1",
        amount: "70000",
        name: "Cliente Uno",
      },
    ]);
    expect(copy).toContain("2 documentos");
    expect(copy).toContain("33-9-76111111-1");
    expect(copy).toContain("33-10-76111111-1");
  });

  it("enumera todas las patas bancarias que una reversión N:N liberará", () => {
    const copy = revertConfirmation(
      [
        {
          document_kind: "receivable",
          document_id: "doc-1",
          source_external_id: "33-9-76111111-1",
          amount: "120000",
          name: "Cliente Uno",
        },
      ],
      [
        {
          movement_id: "mov-1",
          amount: "50000",
          date: "2026-08-01",
          description: "Primer abono",
          currency_code: "CLP",
          bank_account_id: "account-1",
        },
        {
          movement_id: "mov-2",
          amount: "70000",
          date: "2026-08-02",
          description: "Segundo abono",
          currency_code: "CLP",
          bank_account_id: "account-1",
        },
      ],
    );
    expect(copy).toContain("2 movimientos bancarios");
    expect(copy).toContain("Primer abono");
    expect(copy).toContain("Segundo abono");
    expect(copy).toContain("1 documento");
  });
});
