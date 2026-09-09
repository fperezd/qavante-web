import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocumentRowStatusBadges } from "./document-row-status";

describe("DocumentRowStatusBadges", () => {
  it("muestra clasificación y conciliación como estados independientes", () => {
    const html = renderToStaticMarkup(
      <DocumentRowStatusBadges
        status={{
          document_kind: "payable",
          source_external_id: "33-1-76111111-9",
          classification_status: "classified",
          classification_id: "c1",
          account_code: "expense.x",
          reconciliation_status: "partial",
          assignment_count: 1,
        }}
      />,
    );
    expect(html).toContain("Clasificado");
    expect(html).toContain("Pago parcial");
  });
});
