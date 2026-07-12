import { describe, it, expect, vi } from "vitest";
import { dtePdfUrlForDoc } from "./dte-pdf";
import type { RcvDoc } from "./rcv-grouped-item";

/* La ventana del PDF es SOLO el mes de emisión de la fila (no el rango consultado):
   el SII trunca rangos grandes → un rango ancho vuelve 0 documentos (dte_not_found
   engañoso). El mes de emisión ubica el folio con precisión. */

describe("dtePdfUrlForDoc — ventana = solo el mes de emisión de la fila", () => {
  it("ventas: folio emitido 12/02, rango consultado feb–jul → ventana SOLO febrero", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.qavante.com");
    const doc: RcvDoc = { folio: 374, fecha: "12/02/2026", rut_contraparte: "76008959-1" };
    const url = dtePdfUrlForDoc("ventas", doc, { desde: "2026-02-01", hasta: "2026-07-31" });
    // Antes daba 0 docs: mandaba feb–jul (6 meses) y el SII truncaba.
    expect(url).toContain("desde=2026-02-01");
    expect(url).toContain("hasta=2026-02-28");
    expect(url).not.toContain("hasta=2026-07-31");
    expect(url).toContain("folio=374");
    expect(url).toContain("rut_receptor=76008959-1");
    vi.unstubAllEnvs();
  });

  it("compras: folio emitido 30/01 (fuera del rango feb–jul) → ventana SOLO enero", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.qavante.com");
    const doc: RcvDoc = { folio: 3560649, fecha: "30/01/2026", rut_contraparte: "97080000-K" };
    const url = dtePdfUrlForDoc("compras", doc, { desde: "2026-02-01", hasta: "2026-07-31" });
    // El mes de emisión (enero) ubica el folio aunque el rango consultado sea feb–jul,
    // y sin arrastrar el rango ancho que truncaba.
    expect(url).toContain("desde=2026-01-01");
    expect(url).toContain("hasta=2026-01-31");
    expect(url).toContain("folio=3560649");
    expect(url).toContain("rut_emisor=97080000-K");
    vi.unstubAllEnvs();
  });

  it("sin fecha en la fila → cae al rango consultado (fallback)", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.qavante.com");
    const doc: RcvDoc = { folio: 100, fecha: undefined, rut_contraparte: "55555555-5" };
    const url = dtePdfUrlForDoc("ventas", doc, { desde: "2026-03-01", hasta: "2026-03-31" });
    expect(url).toContain("desde=2026-03-01");
    expect(url).toContain("hasta=2026-03-31");
    vi.unstubAllEnvs();
  });

  it("sin fecha ni rango → null (no arma URL inválida)", () => {
    const doc: RcvDoc = { folio: 100, fecha: undefined, rut_contraparte: "55555555-5" };
    expect(dtePdfUrlForDoc("ventas", doc, null)).toBeNull();
  });
});
