import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { csv, csvCell, csvWithBom, downloadCsv } from "./csv";

function parseSemicolonCsv(source: string): string[][] {
  const rows: string[][] = [[]];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted && char === '"' && source[i + 1] === '"') {
      cell += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && char === ";") {
      rows.at(-1)?.push(cell);
      cell = "";
      continue;
    }
    if (!quoted && char === "\n") {
      rows.at(-1)?.push(cell);
      rows.push([]);
      cell = "";
      continue;
    }
    if (!quoted && char === "\r" && source[i + 1] === "\n") continue;
    cell += char;
  }
  rows.at(-1)?.push(cell);
  return rows;
}

describe("csv tipado y seguro", () => {
  it("neutraliza fórmulas sólo para texto e identificadores, incluso con controles/full-width", () => {
    const out = csv(
      ["texto", "rut", "decimal"],
      [[csvCell.text(" \t=1+1"), csvCell.identifier("＋SUM(A1:A2)"), csvCell.decimal(-0.5)]],
    );
    expect(out).toBe("texto;rut;decimal\n' \t=1+1;'＋SUM(A1:A2);-0.5");
  });

  it("conserva folio, cero, ausencia, comillas y saltos de línea sin ambigüedad", () => {
    const out = csv(
      ["folio", "cero", "ausente", "nota"],
      [
        [
          csvCell.identifier("000123"),
          csvCell.decimal(0),
          csvCell.missing(),
          csvCell.text('A; "B"\nlínea'),
        ],
      ],
    );
    expect(out).toBe('folio;cero;ausente;nota\n000123;0;;"A; ""B""\nlínea"');
  });

  it("el parser CSV conserva bytes del folio, cero y ausencia; no modela la inferencia de Excel", () => {
    const out = csv(
      ["folio", "cero", "ausente", "nota"],
      [
        [
          csvCell.identifier("000123"),
          csvCell.decimal(0),
          csvCell.missing(),
          csvCell.text('A; "B"\nlínea'),
        ],
      ],
    );
    expect(parseSemicolonCsv(out)).toEqual([
      ["folio", "cero", "ausente", "nota"],
      ["000123", "0", "", 'A; "B"\nlínea'],
    ]);
  });

  it.each(["=1+1", "+1+1", "-1+1", "@SUM(A1:A2)", "＝1+1", "＋1+1", "－1+1", "＠SUM(A1:A2)"])(
    "neutraliza el vector textual %s incluso tras espacios y controles",
    (payload) => {
      for (const prefix of ["", " ", "\t", "\r\n", "\u0000"]) {
        const value = `${prefix}${payload}`;
        expect(parseSemicolonCsv(csv(["texto"], [[csvCell.text(value)]]))[1]).toEqual([
          `'${value}`,
        ]);
      }
    },
  );

  it.each(["=1+1", "+1+1", "-1+1", "@SUM(A1:A2)", '=HYPERLINK("https://example.invalid";"clic")'])(
    "identificador peligroso %s se neutraliza como literal",
    (value) => {
      expect(parseSemicolonCsv(csv(["folio"], [[csvCell.identifier(value)]]))[1]).toEqual([
        `'${value}`,
      ]);
    },
  );

  it("no agrega texto a un identificador vacío ni a números negativos/cero", () => {
    expect(
      csv(
        ["id", "monto", "cero"],
        [[csvCell.identifier(""), csvCell.decimal(-1), csvCell.integer(0)]],
      ),
    ).toBe("id;monto;cero\n;-1;0");
  });

  it.each([0, 1, 3])("rechaza una fila de %s celdas para dos columnas", (width) => {
    expect(() => csv(["a", "b"], [Array.from({ length: width }, () => csvCell.text("x"))])).toThrow(
      `CSV row has ${width} cells; expected 2`,
    );
  });

  it("acepta una fila cuyo ancho coincide", () => {
    expect(csv(["a", "b"], [[csvCell.text("x"), csvCell.text("y")]])).toBe("a;b\nx;y");
  });

  it("mantiene el dialecto solicitado y exactamente un BOM", () => {
    expect(csvWithBom("\uFEFF\uFEFFa;b")).toBe("\uFEFFa;b");
    expect(csv(["a", "b"], [[csvCell.integer(1), csvCell.boolean(false)]], { eol: "\r\n" })).toBe(
      "a;b\r\n1;false",
    );
  });

  it("descarga un único BOM con MIME CSV y nombre que no permite rutas", async () => {
    const anchor = { href: "", download: "", click: vi.fn() };
    let capturedBlob: Blob | undefined;
    const createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return "blob:csv";
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("document", { createElement: vi.fn(() => anchor) });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    try {
      downloadCsv("../../ reporte ? 2026.csv", "\uFEFFa;b");
      expect(anchor.download).toBe("reporte-2026.csv");
      expect(anchor.href).toBe("blob:csv");
      expect(anchor.click).toHaveBeenCalledOnce();
      if (capturedBlob == null) throw new Error("download did not create a Blob");
      const blob = capturedBlob;
      expect(blob.type).toBe("text/csv;charset=utf-8");
      // Blob.text() decodifica y consume el BOM; se verifica el byte real del archivo.
      expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([
        0xef, 0xbb, 0xbf, 0x61, 0x3b, 0x62,
      ]);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:csv");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("impide que los exports activos reintroduzcan serializadores o descargas paralelas", () => {
    const migrated = [
      "src/components/banco/v03/banco-v03-model.ts",
      "src/components/pagar/v05/pagar-v05-model.ts",
      "src/components/impuestos/v06/impuestos-v06-model.ts",
      "src/components/presupuesto/v09/presupuesto-v09-model.ts",
      "src/components/gestion/v08/gestion-v08-model.ts",
      "src/components/sii/libro-kpis/libro-kpis-format.ts",
    ];
    for (const file of migrated) {
      const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source).toMatch(/from "@\/lib\/export\/csv"/);
      expect(source).not.toMatch(/function (csvCampo|celdaCsv|csvCell)\b/);
    }
  });
});
