import { describe, expect, it } from "vitest";
import {
  aggregateCustomer360Counterparties,
  customer360Series,
  customer360SignedAmount,
  filterCustomer360FocusDocs,
  validateCustomer360Documents,
  type Customer360Document,
  type Customer360Scope,
  type ValidCustomer360Document,
} from "./contraparte-360-model";
import { emptyCoverageMessage } from "./contraparte-360-view";

const scope: Customer360Scope = {
  periodFrom: "2025-10",
  periodTo: "2026-09",
  asOf: "2026-09-08T15:00:00.000Z",
  asOfDate: "2026-09-08",
  timeZone: "America/Santiago",
};

function doc(overrides: Partial<Customer360Document> = {}): Customer360Document {
  return {
    sourcePeriod: "2026-09",
    sourceIndex: 0,
    rut: "76111222-3",
    name: "Cliente X",
    fecha: "08/09/2026",
    monto: 1000,
    folio: 1,
    tipoDoc: 33,
    ...overrides,
  };
}

describe("filterCustomer360FocusDocs", () => {
  it("aplica ambas cotas y el corte as_of del mes actual", () => {
    const docs = [
      doc({ fecha: "30/09/2025", folio: 1 }),
      doc({ fecha: "01/10/2025", folio: 2 }),
      doc({ fecha: "08/09/2026", folio: 3 }),
      doc({ fecha: "09/09/2026", folio: 4 }),
      doc({ fecha: "01/10/2026", folio: 5 }),
    ];
    expect(filterCustomer360FocusDocs(docs, scope).map((item) => item.folio)).toEqual([2, 3]);
  });
});

describe("semántica documental contenida", () => {
  it("separa NC 60/61/112, ND 56/111 y reclamados", () => {
    const valid = [
      doc({ tipoDoc: 33, monto: 1000 }),
      doc({ tipoDoc: 56, monto: 200 }),
      doc({ tipoDoc: 111, monto: 300 }),
      doc({ tipoDoc: 60, monto: 100 }),
      doc({ tipoDoc: 61, monto: 150 }),
      doc({ tipoDoc: 112, monto: 50 }),
      doc({ tipoDoc: 33, monto: 900, reclamado: true }),
    ] as ValidCustomer360Document[];
    expect(valid.map(customer360SignedAmount)).toEqual([1000, 200, 300, -100, -150, -50, 0]);
    const counterparty = aggregateCustomer360Counterparties(valid)[0]!;
    expect(counterparty.total).toBe(1200);
    expect(counterparty.breakdown).toEqual({
      positiveDocumentsGross: 1000,
      debitNotesGross: 500,
      creditNotesGross: 300,
      reclaimedGross: 900,
      reclaimedCount: 1,
    });
  });

  it("monto inválido abstiene en vez de aportar cero", () => {
    const validation = validateCustomer360Documents([doc({ monto: null })], true);
    expect(validation).toMatchObject({
      canAggregate: false,
      reasons: ["invalid_document_amount"],
      docs: [],
    });
  });

  it("fecha inválida de un documento consultado también abstiene", () => {
    const validation = validateCustomer360Documents([], true, 1);
    expect(validation.canAggregate).toBe(false);
    expect(validation.reasons).toEqual(["invalid_document_date"]);
  });
});

describe("identidad y reconciliación", () => {
  it.each(["", "55.555.555-5", "sin-rut", "s/d"])(
    "identidad débil %j abstiene sin filtrar la fila",
    (rut) => {
      const focusDocs = [doc({ rut })];
      const validation = validateCustomer360Documents(focusDocs, true);
      expect(focusDocs).toHaveLength(1);
      expect(validation.canAggregate).toBe(false);
      expect(validation.reasons).toContain("unresolved_counterparty_identity");
    },
  );

  it("tarjeta, suma de barras y ranking cuadran sobre el mismo scope", () => {
    const docs = [
      doc({ rut: "1-9", name: "Uno", fecha: "01/10/2025", monto: 1000 }),
      doc({ rut: "1-9", name: "Uno", fecha: "08/09/2026", monto: 200 }),
      doc({ rut: "2-7", name: "Dos", fecha: "10/03/2026", monto: 300 }),
    ];
    const focus = filterCustomer360FocusDocs(docs, scope);
    const validation = validateCustomer360Documents(focus, true);
    expect(validation.canAggregate).toBe(true);
    const ranking = aggregateCustomer360Counterparties(validation.docs);
    const totalRanking = ranking.reduce((sum, item) => sum + item.total, 0);
    expect(totalRanking).toBe(1500);
    for (const item of ranking) {
      const seriesTotal = customer360Series(validation.docs, item.rut, scope).reduce(
        (sum, point) => sum + point.monto,
        0,
      );
      expect(seriesTotal).toBe(item.total);
    }
  });

  it("la serie parcial sólo incluye meses observados y nunca rellena ausencias como cero", () => {
    const docs = [
      doc({ rut: "1-9", fecha: "01/10/2025", monto: 1000 }),
      doc({ rut: "1-9", fecha: "10/03/2026", monto: 300 }),
    ] as ValidCustomer360Document[];
    expect(customer360Series(docs, "1-9", scope, ["2025-10", "2026-03"])).toEqual([
      { periodo: "2025-10", monto: 1000 },
      { periodo: "2026-03", monto: 300 },
    ]);
  });
});

describe("cobertura parcial visible", () => {
  it("no presenta meses sin respuesta como una ausencia de ventas", () => {
    expect(emptyCoverageMessage("Ventas", 1, false)).toBe(
      "No observamos ventas en 1 mes observado; 11 meses siguen sin respuesta.",
    );
  });

  it("sólo declara vacío de toda la ventana cuando la cobertura está completa", () => {
    expect(emptyCoverageMessage("Compras", 12, true)).toBe(
      "No observamos compras en la ventana indicada.",
    );
  });
});
