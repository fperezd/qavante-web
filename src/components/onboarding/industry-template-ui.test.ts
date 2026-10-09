import { describe, expect, it } from "vitest";
import type { IndustryTemplate } from "@/lib/api/industry-templates";
import { buildIndustryTemplateGroups, filterIndustryTemplates } from "./industry-template-ui";

function tpl(
  partial: Pick<IndustryTemplate, "code" | "name" | "business_family">,
): IndustryTemplate {
  return {
    id: partial.code,
    code: partial.code,
    name: partial.name,
    business_family: partial.business_family,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    is_active: true,
    sort_order: 0,
  };
}

describe("industry-template-ui", () => {
  it("agrupa por familia y ordena rubros alfabéticamente dentro de cada grupo", () => {
    const groups = buildIndustryTemplateGroups(
      [
        tpl({ code: "b", name: "Retail", business_family: "commerce" }),
        tpl({ code: "a", name: "Consultoría", business_family: "professional" }),
        tpl({ code: "c", name: "Ecommerce", business_family: "commerce" }),
      ],
      "",
    );
    expect(groups.map((g) => g.family)).toEqual(["professional", "commerce"]);
    expect(groups[1]?.items.map((i) => i.name)).toEqual(["Ecommerce", "Retail"]);
  });

  it("filtra por nombre, descripción y familia", () => {
    const items = [
      tpl({ code: "x", name: "Manufactura", business_family: "production" }),
      tpl({ code: "y", name: "Retail", business_family: "commerce" }),
    ];
    expect(filterIndustryTemplates(items, "comercio").map((i) => i.code)).toEqual(["y"]);
    expect(filterIndustryTemplates(items, "manu").map((i) => i.code)).toEqual(["x"]);
  });
});
