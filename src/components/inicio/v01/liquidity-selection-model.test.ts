import { describe, expect, it } from "vitest";
import type { DecisionSelectionResponse } from "@/lib/api/financial-decisions";
import { ApiError } from "@/lib/api/errors";
import { selectionErrorMessage, selectionSuccessMessage } from "./liquidity-selection-model";

function result(over: Partial<DecisionSelectionResponse> = {}): DecisionSelectionResponse {
  return {
    selection_id: "10000000-0000-4000-8000-000000000001",
    decision_id: "20000000-0000-4000-8000-000000000001",
    alternative_id: "30000000-0000-4000-8000-000000000001",
    operation_required: true,
    operation_plan_id: "40000000-0000-4000-8000-000000000001",
    operation_status: "draft",
    replayed: false,
    ...over,
  };
}

describe("selección humana de alternativa", () => {
  it.each([
    [401, "sesión venció"],
    [403, "rol no está autorizado"],
    [409, "decisión cambió"],
    [422, "ya no cumple"],
  ])("explica el error material HTTP %i sin afirmar éxito", (status, text) => {
    expect(selectionErrorMessage(new ApiError("backend", status))).toContain(text);
  });

  it("ante error de red conserva la semántica de reintento idempotente", () => {
    expect(selectionErrorMessage(new ApiError("network", 0, "network_error"))).toContain(
      "sin cambiar el motivo",
    );
  });

  it("distingue un OperationPlan draft de no_action sin plan", () => {
    expect(selectionSuccessMessage(result())).toContain("plan operativo en borrador");
    expect(
      selectionSuccessMessage(
        result({
          operation_required: false,
          operation_plan_id: null,
          operation_status: null,
        }),
      ),
    ).toContain("No requiere un plan operativo");
  });

  it("presenta el replay como la misma selección, no como otra operación", () => {
    expect(selectionSuccessMessage(result({ replayed: true }))).toBe(
      "Esta misma selección ya estaba registrada.",
    );
  });
});
