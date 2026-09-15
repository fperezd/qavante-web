import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const productionFiles = readdirSync(HERE)
  .filter((name) => /\.tsx?$/.test(name) && !/\.(test|stories)\.tsx?$/.test(name))
  .map((name) => ({ name, source: readFileSync(join(HERE, name), "utf8") }));

describe("Pagar V2 no deriva brechas financieras", () => {
  it("prohíbe helpers y restas entre obligaciones y caja en código productivo", () => {
    const forbidden = [
      /calcularBrecha/,
      /brechaResidual/,
      /(?:criticos|críticos|pagosCriticos|due_14d)\s*-\s*(?:caja|cash|projected)/i,
      /(?:caja|cash|projected)\s*-\s*(?:criticos|críticos|pagosCriticos|due_14d)/i,
    ];

    for (const file of productionFiles) {
      for (const pattern of forbidden) {
        expect(file.source, `${file.name} contiene ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("consume agregados ejecutivos full-universe y sólo rotula el detalle local como visible", () => {
    const live = productionFiles.find((file) => file.name === "pagar-v2-view-live.tsx")?.source;
    expect(live).toBeDefined();
    expect(live).toContain("resp?.total");
    expect(live).toContain("resp?.due_7d");
    expect(live).toContain("resp?.due_30d");
    expect(live).toContain("resp?.items_total");
    expect(live).toContain("resp?.has_more");
    expect(live).not.toMatch(/const montoTotal\s*=\s*items\.(?:reduce|filter|map)/);
    expect(live).not.toMatch(/const due(?:7|30)\s*=\s*sumItemsHasta/);
    expect(live).toContain("pagos mostrados");
    expect(live).toContain("vencidos visibles");
  });
});
