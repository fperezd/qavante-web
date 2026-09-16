import { describe, expect, it } from "vitest";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LOCAL_CASH_GAP_PATTERNS,
  LOCAL_CASH_GAP_SAMPLES,
  productionSources,
} from "@/test/no-local-cash-gap";

const HERE = dirname(fileURLToPath(import.meta.url));
const productionFiles = productionSources(HERE);

describe("Pagar V2 no deriva brechas financieras", () => {
  it("prohíbe helpers y restas entre obligaciones y caja en código productivo", () => {
    expect(productionFiles.length).toBeGreaterThan(0);
    for (const file of productionFiles) {
      for (const pattern of LOCAL_CASH_GAP_PATTERNS) {
        expect(file.source, `${file.name} contiene ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("GEMELO POSITIVO · los patrones atrapan las formas que prohíben", () => {
    for (const sample of LOCAL_CASH_GAP_SAMPLES) {
      expect(
        LOCAL_CASH_GAP_PATTERNS.some((pattern) => pattern.test(sample)),
        `ningún patrón casa con: ${sample}`,
      ).toBe(true);
    }
  });

  it("consume agregados ejecutivos full-universe y sólo rotula el detalle local como visible", () => {
    const live = productionFiles.find((file) =>
      file.name.endsWith("pagar-v2-view-live.tsx"),
    )?.source;
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
