import { describe, expect, it } from "vitest";
import { operationalResultExportCsvPath } from "./gestion";

describe("operationalResultExportCsvPath", () => {
  it("pide el export nativo con el mismo rango del pivote y CSV explícito", () => {
    expect(operationalResultExportCsvPath("2026-05", "2026-07")).toBe(
      "/api/management/operational-result/export?period_from=2026-05&period_to=2026-07&format=csv&include_proforma=true",
    );
  });

  it("no pide xlsx ni llama al endpoint de breakdown como sustituto", () => {
    const path = operationalResultExportCsvPath("2026-05", "2026-07");
    expect(path).toContain("format=csv");
    expect(path).not.toContain("xlsx");
    expect(path).not.toMatch(/\/breakdown/);
  });
});
