import { describe, it, expect, vi } from "vitest";
import { unionWindow, dtePdfUrlForDoc } from "./dte-pdf";
import type { RcvDoc } from "./rcv-grouped-item";

describe("unionWindow", () => {
  it("une: desde = el más temprano, hasta = el más tardío", () => {
    expect(
      unionWindow(
        { desde: "2026-01-01", hasta: "2026-01-31" },
        { desde: "2026-02-01", hasta: "2026-07-31" },
      ),
    ).toEqual({ desde: "2026-01-01", hasta: "2026-07-31" });
  });

  it("devuelve la ventana que exista si la otra es null", () => {
    const w = { desde: "2026-01-01", hasta: "2026-01-31" };
    expect(unionWindow(w, null)).toEqual(w);
    expect(unionWindow(null, w)).toEqual(w);
    expect(unionWindow(null, null)).toBeNull();
  });
});

describe("dtePdfUrlForDoc — la ventana INCLUYE el mes de emisión de la fila", () => {
  const doc: RcvDoc = { folio: 3560649, fecha: "30/01/2026", rut_contraparte: "97080000-K" };

  it("compras: folio emitido en enero + rango consultado feb–jul → ventana ene–jul", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.qavante.com");
    const url = dtePdfUrlForDoc("compras", doc, { desde: "2026-02-01", hasta: "2026-07-31" });
    // Antes daba dte_not_found: el rango feb–jul NO incluía el 30/01.
    expect(url).toContain("desde=2026-01-01");
    expect(url).toContain("hasta=2026-07-31");
    expect(url).toContain("folio=3560649");
    expect(url).toContain("rut_emisor=97080000-K");
    vi.unstubAllEnvs();
  });
});
