/* Sanity del contrato industry-templates vía MSW + estabilidad de query
   keys (Addendum §13.5/§13.6/§14.1/§14.2). Si rompe tras tocar handlers.ts
   o industry-templates.ts, el mock dejó de respetar el shape que la UI
   espera (apply summary, dimensions/accounts sugeridas, modes). */
import { describe, expect, it } from "vitest";
import {
  industryTemplatesKeys,
  type IndustryTemplate,
  type IndustryTemplateDetail,
  type ApplyTemplateResponse,
} from "./industry-templates";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

describe("industryTemplatesKeys", () => {
  it("namespacing estable y discriminado por templateCode", () => {
    expect(industryTemplatesKeys.all).toEqual(["industry-templates"]);
    expect(industryTemplatesKeys.list()).toEqual(["industry-templates", "list"]);
    expect(industryTemplatesKeys.detail("services")).toEqual([
      "industry-templates",
      "detail",
      "services",
    ]);
    expect(industryTemplatesKeys.detail("services")).not.toEqual(
      industryTemplatesKeys.detail("commerce"),
    );
  });
});

describe("MSW — GET /api/management/industry-templates", () => {
  it("devuelve catálogo con shape IndustryTemplate completo", async () => {
    const r = await fetch(`${API}/api/management/industry-templates`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as { items: IndustryTemplate[] };
    expect(body.items.length).toBeGreaterThan(0);

    for (const t of body.items) {
      expect(typeof t.id).toBe("string");
      expect(typeof t.code).toBe("string");
      expect(typeof t.name).toBe("string");
      expect(typeof t.business_family).toBe("string");
      expect(typeof t.is_active).toBe("boolean");
      expect(typeof t.sort_order).toBe("number");
    }
  });

  it("incluye al menos la plantilla 'services' (rubro PYME más común)", async () => {
    const r = await fetch(`${API}/api/management/industry-templates`);
    const body = (await r.json()) as { items: IndustryTemplate[] };
    const services = body.items.find((t) => t.code === "services");
    expect(services).toBeDefined();
    expect(services?.business_family).toBe("services");
  });
});

describe("MSW — GET /api/management/industry-templates/{code}", () => {
  it("services → template + dimensions + accounts sugeridas", async () => {
    const r = await fetch(`${API}/api/management/industry-templates/services`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as IndustryTemplateDetail;
    expect(body.template.code).toBe("services");
    expect(Array.isArray(body.dimensions)).toBe(true);
    expect(Array.isArray(body.accounts)).toBe(true);
    expect(body.dimensions.length).toBeGreaterThan(0);
    expect(body.accounts.length).toBeGreaterThan(0);

    const dim0 = body.dimensions[0];
    if (!dim0) throw new Error("services debe traer al menos una dimensión");
    expect(typeof dim0.dimension_code).toBe("string");
    expect(typeof dim0.default_visible).toBe("boolean");
  });

  it("code inexistente → 404", async () => {
    const r = await fetch(`${API}/api/management/industry-templates/xxx-noexiste`);
    expect(r.status).toBe(404);
  });
});

describe("MSW — POST /apply (§14.1 nunca destructivo)", () => {
  it("mode=suggest_only → devuelve diff sin escribir (preview)", async () => {
    const r = await fetch(`${API}/api/management/industry-templates/services/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "suggest_only", overwrite_existing: false }),
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as ApplyTemplateResponse;
    expect(body.template_code).toBe("services");
    expect(body.mode).toBe("suggest_only");
    expect(typeof body.summary.accounts_to_add).toBe("number");
    expect(typeof body.summary.dimensions_to_add).toBe("number");
    /* Preview puebla las listas (UI las muestra como tabla). */
    expect(Array.isArray(body.accounts_preview)).toBe(true);
    expect(Array.isArray(body.dimensions_preview)).toBe(true);
  });

  it("mode=add_missing → suma counts no-cero (services tiene dims/accounts)", async () => {
    const r = await fetch(`${API}/api/management/industry-templates/services/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "add_missing", overwrite_existing: false }),
    });
    const body = (await r.json()) as ApplyTemplateResponse;
    expect(body.mode).toBe("add_missing");
    expect(body.summary.accounts_to_add).toBeGreaterThan(0);
    expect(body.summary.dimensions_to_add).toBeGreaterThan(0);
  });

  it("template inexistente → 404", async () => {
    const r = await fetch(`${API}/api/management/industry-templates/xxx/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "suggest_only", overwrite_existing: false }),
    });
    expect(r.status).toBe(404);
  });
});
