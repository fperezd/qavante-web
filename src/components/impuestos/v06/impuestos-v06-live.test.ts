import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { motivoSinEstimacion } from "./impuestos-v06-live";

describe("ImpuestosV06Live · degradación de la estimación", () => {
  it("un error de red no reutiliza un monto anterior como reemplazo", () => {
    expect(motivoSinEstimacion(new ApiError("offline", 0))).toContain(
      "No mostramos un monto desactualizado como reemplazo",
    );
  });

  it("un error del servicio conserva el calendario oficial", () => {
    expect(motivoSinEstimacion(new ApiError("falló", 502))).toContain(
      "El calendario conserva los estados oficiales disponibles",
    );
  });
});
