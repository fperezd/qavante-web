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

    expect(html).toContain("Sin información");
    expect(html).toContain("Cobros sin verificar");
    expect(html).toContain("trazabilidad de conciliación");
    expect(html).not.toContain("$0");
  });
});
