import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CollectedMetricCard } from "./gestion-cobros-live";

describe("Cobrado · cobertura de conciliación", () => {
  it("presenta la abstención histórica en vez de un monto inventado", () => {
    const html = renderToStaticMarkup(
      <CollectedMetricCard
        data={{
          collected: null,
          collected_coverage: "unverified_legacy_collections",
          collected_reason: "legacy_collection_lineage_unavailable",
        }}
      />,
    );

    // No un monto inventado, y tampoco "Sin información": una acción concreta y el camino.
    expect(html).toContain("Conciliación por cerrar");
    expect(html).toContain("conciliado con su movimiento de banco");
    expect(html).toContain('href="/banco"');
    expect(html).not.toContain("$0");
    expect(html).not.toContain("Sin información");
  });
});
