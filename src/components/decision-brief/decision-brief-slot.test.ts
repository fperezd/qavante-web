import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  decisionBriefFailureMode,
  decisionBriefRetryLabel,
  hasDecisionBriefContextChanged,
  type DecisionBriefIdentity,
} from "./decision-brief-slot";

const ORIGINAL: DecisionBriefIdentity = {
  decision_id: "6cb9e47a-f682-46d6-9d8a-3c851c8ff420",
  context_hash: "ed0c2b7304923da062e78ac73c54352bd3925d5c4bbee006fe9ae9d43346d66f",
};

describe("DecisionBriefSlot — degradación y cambio de corte", () => {
  it("omite sólo el 404 del endpoint; un 5xx conserva una salida reintentable", () => {
    expect(decisionBriefFailureMode(new ApiError("sin brief", 404))).toBe("omit");
    expect(decisionBriefFailureMode(new ApiError("caído", 503))).toBe("retry");
    expect(decisionBriefFailureMode(new Error("red caída"))).toBe("retry");
  });

  it("anuncia el reintento en vuelo en vez de ofrecer otra lectura del mismo corte", () => {
    expect(decisionBriefRetryLabel(false)).toBe("Reintentar");
    expect(decisionBriefRetryLabel(true)).toBe("Reintentando…");
  });

  it("avisa cuando el servidor publica un contexto nuevo, sin mezclarlo con el anterior", () => {
    expect(hasDecisionBriefContextChanged(ORIGINAL, { ...ORIGINAL })).toBe(false);
    expect(
      hasDecisionBriefContextChanged(ORIGINAL, {
        ...ORIGINAL,
        context_hash: "2f08e4dc0507cf65e5455ccc8bbd91c6d16c3fa64b940240a10876714a7c6fc7",
      }),
    ).toBe(true);
    expect(
      hasDecisionBriefContextChanged(ORIGINAL, {
        ...ORIGINAL,
        decision_id: "75b6e342-6e10-4d60-9059-bcd0e05a7f5a",
      }),
    ).toBe(true);
  });
});
