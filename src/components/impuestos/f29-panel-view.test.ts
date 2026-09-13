import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { describeReqError } from "./f29-panel-view";

describe("describeReqError", () => {
  it("no expone estado, código ni diagnóstico interno", () => {
    const raw = "TypeError at /api/sii/f29 trace_id_123";
    const visible = describeReqError(new ApiError(raw, 500, "unknown_backend_code"));

    expect(visible).toBe("No pudimos cargar la información. Intenta nuevamente.");
    expect(visible).not.toMatch(/500|unknown_backend_code|TypeError|\/api\/|trace_id/);
  });

  it("conserva acciones específicas para red y espera excesiva", () => {
    expect(describeReqError(new ApiError("red", 0, "network_error"))).toContain(
      "Revisa tu conexión",
    );
    expect(describeReqError(new ApiError("timeout", 504))).toContain("tardó demasiado");
    expect(describeReqError(new ApiError("timeout", 504))).not.toContain("timeout");
  });
});
