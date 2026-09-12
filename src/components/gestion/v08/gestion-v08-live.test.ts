import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { motivoExportExcel } from "./gestion-v08-live";

describe("error del export Excel", () => {
  it("si el servidor responde algo que no es XLSX, lo explica y confirma que no descargó", () => {
    expect(
      motivoExportExcel(
        new ApiError("El servidor no entregó un archivo Excel válido.", 200, "invalid_xlsx_magic"),
      ),
    ).toBe("El servidor no entregó un archivo Excel válido. No se descargó nada.");
  });

  it("un error de red conserva la explicación y la acción existente", () => {
    expect(motivoExportExcel(new ApiError("red", 0, "network_error"))).toBe(
      "No pudimos conectar con el archivo Excel de tu Estado de Resultados (error de red). Vuelve a intentar en un momento.",
    );
  });
});
