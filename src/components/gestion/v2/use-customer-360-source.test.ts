import { describe, expect, it } from "vitest";
import type { RcvVentasResponse } from "@/lib/api/sii";
import {
  aggregateCustomer360Counterparties,
  validateCustomer360Documents,
} from "./contraparte-360-model";
import {
  adaptCustomer360Document,
  composeCustomer360Source,
  customer360Periods,
  customer360Scope,
  type Customer360MonthInput,
} from "./use-customer-360-source";

function response(
  periodo: string,
  ventas: NonNullable<RcvVentasResponse["ventas"]>,
  overrides: Partial<RcvVentasResponse> = {},
): RcvVentasResponse {
  return {
    status: "ok",
    count: ventas.length,
    stale: false,
    periodo,
    ventas,
    ...overrides,
  };
}

function observedInputs(
  periods: string[],
  makeResponse: (period: string) => RcvVentasResponse = (period) => response(period, []),
): Customer360MonthInput[] {
  return periods.map((period) => ({ period, state: "success", response: makeResponse(period) }));
}

describe("customer360Scope", () => {
  it("septiembre 2026 consulta exactamente octubre 2025 a septiembre 2026", () => {
    const scope = customer360Scope(new Date("2026-09-08T15:00:00Z"));
    expect(scope).toMatchObject({
      periodFrom: "2025-10",
      periodTo: "2026-09",
      asOfDate: "2026-09-08",
      timeZone: "America/Santiago",
    });
    const periods = customer360Periods(scope);
    expect(periods).toHaveLength(12);
    expect(periods[0]).toBe("2025-10");
    expect(periods.at(-1)).toBe("2026-09");
  });

  it("usa Santiago en el borde UTC y no adelanta octubre", () => {
    const scope = customer360Scope(new Date("2026-10-01T00:30:00Z"));
    expect(scope.periodTo).toBe("2026-09");
    expect(scope.asOfDate).toBe("2026-09-30");
  });
});

describe("composeCustomer360Source", () => {
  const scope = customer360Scope(new Date("2026-09-08T15:00:00Z"));
  const periods = customer360Periods(scope);

  it("una falla entre doce conserva los meses observados y declara cobertura parcial", () => {
    const inputs = observedInputs(periods);
    inputs[4] = { period: periods[4]!, state: "error" };
    const source = composeCustomer360Source("ventas", scope, inputs);
    expect(source.canAggregatePeriods).toBe(true);
    expect(source.isCoverageComplete).toBe(false);
    expect(source.coverage[4]).toMatchObject({
      period: periods[4],
      state: "error",
      count: null,
      reason: "query_error",
    });
    expect(source.coverage.filter((month) => month.state === "observed_zero")).toHaveLength(11);
  });

  it("respuesta exitosa vacía es observed_zero, no un claim complete", () => {
    const source = composeCustomer360Source("ventas", scope, observedInputs(periods));
    expect(source.canAggregatePeriods).toBe(true);
    expect(source.isCoverageComplete).toBe(true);
    expect(source.coverage).toHaveLength(12);
    expect(source.coverage.every((month) => month.state === "observed_zero")).toBe(true);
    expect(source.focusDocs).toEqual([]);
    expect(source.coverage.map((month) => month.state)).not.toContain("complete");
  });

  it("preserva count, last_synced_at y stale por mes", () => {
    const inputs = observedInputs(periods, (period) =>
      period === "2026-09"
        ? response(
            period,
            [
              {
                tipo_doc: 33,
                folio: 1,
                rut_contraparte: "76111222-3",
                razon_social: "Cliente",
                fecha: "08/09/2026",
                monto_total: 1200,
                complete: true,
                reclamado: false,
                cedido: false,
              },
            ],
            { last_synced_at: "2026-09-08T12:30:00Z", stale: true },
          )
        : response(period, []),
    );
    const source = composeCustomer360Source("ventas", scope, inputs);
    expect(source.coverage.at(-1)).toMatchObject({
      state: "observed",
      count: 1,
      lastSyncedAt: "2026-09-08T12:30:00Z",
      stale: true,
    });
    expect(source.stalePeriods).toEqual(["2026-09"]);
  });

  it("respuesta ausente o inconsistente queda fuera de cobertura, sin borrar evidencia válida", () => {
    const missing = observedInputs(periods).slice(1);
    const partial = composeCustomer360Source("ventas", scope, missing);
    expect(partial.canAggregatePeriods).toBe(true);
    expect(partial.isCoverageComplete).toBe(false);

    const mismatch = observedInputs(periods);
    mismatch[0] = {
      period: periods[0]!,
      state: "success",
      response: response(periods[0]!, [], { count: 1 }),
    };
    const inconsistent = composeCustomer360Source("ventas", scope, mismatch);
    expect(inconsistent.canAggregatePeriods).toBe(true);
    expect(inconsistent.isCoverageComplete).toBe(false);
    expect(inconsistent.coverage[0]?.state).toBe("absent");
  });

  it("reconcilia exactamente 12 documentos y su total cuando cada respuesta pertenece a su mes", () => {
    const inputs = observedInputs(periods, (period) =>
      response(period, [
        {
          tipo_doc: 33,
          folio: Number(period.replace("-", "")),
          rut_contraparte: "76111222-3",
          razon_social: "Cliente",
          fecha: `${period}-01`,
          monto_total: 1_000,
          complete: true,
          reclamado: false,
          cedido: false,
        },
      ]),
    );
    const source = composeCustomer360Source("ventas", scope, inputs);
    const validation = validateCustomer360Documents(
      source.focusDocs,
      source.canAggregatePeriods,
      source.invalidDateDocuments,
      source.ambiguousDocumentIdentities,
    );
    const counterparty = aggregateCustomer360Counterparties(validation.docs)[0]!;

    expect(validation.canAggregate).toBe(true);
    expect(counterparty.docs).toBe(12);
    expect(counterparty.total).toBe(12_000);
  });

  it("excluye un período cuya respuesta no coincide, sin borrar los meses válidos", () => {
    const inputs = observedInputs(periods);
    inputs[0] = {
      period: periods[0]!,
      state: "success",
      response: response("2026-09", []),
    };
    const source = composeCustomer360Source("ventas", scope, inputs);
    expect(source.canAggregatePeriods).toBe(true);
    expect(source.isCoverageComplete).toBe(false);
    expect(source.coverage[0]).toMatchObject({
      state: "absent",
      reason: "response_period_mismatch",
    });
  });

  it("excluye un documento cuya fecha no coincide con el mes solicitado", () => {
    const inputs = observedInputs(periods);
    inputs[0] = {
      period: periods[0]!,
      state: "success",
      response: response(periods[0]!, [
        {
          tipo_doc: 33,
          folio: 1,
          rut_contraparte: "76111222-3",
          razon_social: "Cliente",
          fecha: "2025-11-01",
          monto_total: 1_000,
          complete: true,
          reclamado: false,
          cedido: false,
        },
      ]),
    };
    const source = composeCustomer360Source("ventas", scope, inputs);
    expect(source.canAggregatePeriods).toBe(true);
    expect(source.isCoverageComplete).toBe(false);
    expect(source.coverage[0]).toMatchObject({
      state: "absent",
      reason: "document_period_mismatch",
    });
  });

  it("sin ningún mes válido se abstiene", () => {
    const source = composeCustomer360Source(
      "ventas",
      scope,
      periods.map((period) => ({ period, state: "error" as const })),
    );
    expect(source.canAggregatePeriods).toBe(false);
    expect(source.isCoverageComplete).toBe(false);
  });

  it("deduplica evidencia idéntica y abstiene ante una colisión documental", () => {
    const document = {
      tipo_doc: 33,
      folio: 1,
      rut_contraparte: "76111222-3",
      razon_social: "Cliente",
      fecha: "2026-09-01",
      monto_total: 1_000,
      complete: true,
      reclamado: false,
      cedido: false,
    };
    const repeated = observedInputs(periods);
    repeated[11] = {
      period: "2026-09",
      state: "success",
      response: response("2026-09", [document, { ...document }]),
    };
    const deduplicated = composeCustomer360Source("ventas", scope, repeated);
    expect(deduplicated.focusDocs).toHaveLength(1);
    expect(deduplicated.ambiguousDocumentIdentities).toBe(0);

    repeated[11] = {
      period: "2026-09",
      state: "success",
      response: response("2026-09", [document, { ...document, monto_total: 2_000 }]),
    };
    const conflicting = composeCustomer360Source("ventas", scope, repeated);
    const validation = validateCustomer360Documents(
      conflicting.focusDocs,
      conflicting.canAggregatePeriods,
      conflicting.invalidDateDocuments,
      conflicting.ambiguousDocumentIdentities,
    );
    expect(conflicting.ambiguousDocumentIdentities).toBe(1);
    expect(validation.canAggregate).toBe(false);
    expect(validation.reasons).toContain("ambiguous_document_identity");
  });
});

describe("adaptCustomer360Document", () => {
  it("mantiene cero observado y deja monto ausente/inválido como null", () => {
    expect(adaptCustomer360Document({ monto_total: 0 }, "2026-09", 0).monto).toBe(0);
    expect(adaptCustomer360Document({}, "2026-09", 0).monto).toBeNull();
    expect(adaptCustomer360Document({ monto_total: "no-numérico" }, "2026-09", 0).monto).toBeNull();
  });
});
