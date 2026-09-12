import { describe, expect, it, vi } from "vitest";
import { downloadBinary, safeDownloadFilename } from "./download";

describe("descarga binaria segura", () => {
  it("conserva el nombre contractual XLSX sin aceptar rutas ni doble extensión", () => {
    expect(safeDownloadFilename("resultado-operacional_2026-05_2026-07.xlsx", ".xlsx")).toBe(
      "resultado-operacional_2026-05_2026-07.xlsx",
    );
    expect(safeDownloadFilename("../../reporte.csv.xlsx", ".xlsx")).toBe("reporte.csv.xlsx");
    expect(safeDownloadFilename("..\\..\\? .xlsx", ".xlsx")).toBe("export.xlsx");
  });

  it("crea un Blob con bytes/MIME exactos, hace un clic y siempre revoca la URL", async () => {
    const anchor = { href: "", download: "", click: vi.fn() };
    let blob: Blob | undefined;
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("document", { createElement: vi.fn(() => anchor) });
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn((value: Blob) => {
        blob = value;
        return "blob:xlsx";
      }),
      revokeObjectURL,
    });
    try {
      downloadBinary(
        {
          bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
          filename: "resultado-operacional.xlsx",
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        ".xlsx",
      );
      expect(anchor).toMatchObject({
        href: "blob:xlsx",
        download: "resultado-operacional.xlsx",
      });
      expect(anchor.click).toHaveBeenCalledOnce();
      expect(blob?.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect([...new Uint8Array(await blob!.arrayBuffer())]).toEqual([0x50, 0x4b, 0x03, 0x04]);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:xlsx");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("revoca la URL aunque el navegador rechace el clic", () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("document", {
      createElement: () => ({
        href: "",
        download: "",
        click: () => {
          throw new Error("click bloqueado");
        },
      }),
    });
    vi.stubGlobal("URL", { createObjectURL: () => "blob:xlsx", revokeObjectURL });
    try {
      expect(() =>
        downloadBinary(
          {
            bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
            filename: "reporte.xlsx",
            contentType: "application/octet-stream",
          },
          ".xlsx",
        ),
      ).toThrow("click bloqueado");
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:xlsx");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
