import { describe, expect, it } from "vitest";
import type { ReceivableDocumentItem } from "@/lib/api/cobranza";
import {
  collectedMetric,
  formatCollectionMoney,
  hasAmbiguousReminderFailure,
  isReminderEligible,
  matchesCollectionStatus,
  reminderIdempotencyKey,
} from "./gestion-cobros-live";

const BASE: ReceivableDocumentItem = {
  id: "00000000-0000-0000-0000-000000000001",
  folio: "101",
  customer_name: "Cliente de prueba",
  issue_date: "2026-09-01",
  due_date: "2026-09-15",
  due_date_certainty: "confirmed",
  status: "open",
  total_amount: "125000",
  outstanding_amount: "125000",
  currency_code: "CLP",
  days_overdue: 1,
  ceded: false,
  claimed: false,
  credit_note: false,
};

describe("filtros de gestión de cobros", () => {
  it("excluye documentos cedidos de todo lo cobrable", () => {
    const ceded = { ...BASE, ceded: true };
    expect(matchesCollectionStatus(ceded, "collectable", "2026-09-16")).toBe(false);
    expect(matchesCollectionStatus(ceded, "overdue", "2026-09-16")).toBe(false);
  });

  it("separa vencimiento desconocido de vencido", () => {
    const undated = {
      ...BASE,
      due_date: null,
      due_date_certainty: "unconfirmed" as const,
      days_overdue: null,
    };
    expect(matchesCollectionStatus(undated, "undated", "2026-09-16")).toBe(true);
    expect(matchesCollectionStatus(undated, "overdue", "2026-09-16")).toBe(false);
  });

  it("no permite recordar notas de crédito ni saldos no positivos", () => {
    expect(isReminderEligible({ ...BASE, credit_note: true })).toBe(false);
    expect(isReminderEligible({ ...BASE, outstanding_amount: "0" })).toBe(false);
    expect(isReminderEligible({ ...BASE, outstanding_amount: "-100" })).toBe(false);
    expect(isReminderEligible(BASE)).toBe(true);
  });
});

describe("totales monetarios", () => {
  it("mantiene monedas distintas explícitamente separadas", () => {
    const label = formatCollectionMoney([
      { currency: "CLP", amount: "125000" },
      { currency: "USD", amount: "12.5" },
    ]);
    expect(label).toContain("$125.000");
    expect(label).toContain("US$ 12,50");
    expect(label).toContain(" · ");
  });

  it("no convierte una abstención de cobros en $0 y explica la cobertura", () => {
    const metric = collectedMetric({
      collected: null,
      collected_coverage: "unverified_legacy_collections",
      collected_reason: "legacy_collection_lineage_unavailable",
    });

    expect(metric).toEqual({
      value: "Sin información",
      detail: "Cobros sin verificar",
      note: "No podemos verificar los cobros históricos hasta contar con su trazabilidad de conciliación.",
    });
    expect(formatCollectionMoney(null)).toBe("Sin información");
  });
});

describe("idempotencia manual", () => {
  it("conserva la misma clave al reintentar la misma selección", () => {
    const keys = new Map<string, string>();
    const first = reminderIdempotencyKey(keys, ["b", "a"], () => "stable-key");
    const retry = reminderIdempotencyKey(keys, ["a", "b"], () => "other-key");

    expect(retry).toEqual(first);
  });

  it("mantiene el intento abierto cuando el proveedor devuelve un error ambiguo", () => {
    expect(
      hasAmbiguousReminderFailure([{ receivable_id: "a", status: "error", detail: "timeout" }]),
    ).toBe(true);
    expect(
      hasAmbiguousReminderFailure([
        { receivable_id: "a", status: "sent", detail: "ok" },
        { receivable_id: "b", status: "sin_destinatario", detail: "sin correo" },
      ]),
    ).toBe(false);
  });
});
