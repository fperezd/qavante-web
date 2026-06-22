import { describe, it, expect } from "vitest";
import {
  ONBOARDING_STEPS,
  TOTAL_ONBOARDING_STEPS,
  ONBOARDING_DONE_ROUTE,
  stepIndex,
  stepById,
  stepByRoute,
  progressPct,
  stepNumber,
  nextStep,
  prevStep,
  routeAfter,
  stepRouteOrFirst,
} from "./onboarding-steps";

describe("onboarding-steps — modelo del wizard", () => {
  it("tiene 7 pasos en orden, ids únicos", () => {
    expect(TOTAL_ONBOARDING_STEPS).toBe(7);
    const ids = ONBOARDING_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      "signup",
      "verify-email",
      "connect-sii",
      "connect-bank",
      "industry",
      "opening-balance",
      "import",
    ]);
  });

  it("rutas únicas y no vacías", () => {
    const routes = ONBOARDING_STEPS.map((s) => s.route);
    expect(new Set(routes).size).toBe(routes.length);
    for (const r of routes) expect(r.startsWith("/")).toBe(true);
  });

  it("signup y verify-email son pre-auth; el resto post-auth", () => {
    expect(stepById("signup")?.phase).toBe("pre-auth");
    expect(stepById("verify-email")?.phase).toBe("pre-auth");
    expect(stepById("connect-sii")?.phase).toBe("post-auth");
    expect(stepById("import")?.phase).toBe("post-auth");
  });

  it("stepIndex / stepNumber", () => {
    expect(stepIndex("signup")).toBe(0);
    expect(stepIndex("import")).toBe(6);
    expect(stepNumber("signup")).toBe(1);
    expect(stepNumber("import")).toBe(7);
  });

  it("stepByRoute matchea por ruta exacta y por prefijo", () => {
    expect(stepByRoute("/registro")?.id).toBe("signup");
    expect(stepByRoute("/onboarding/conectar-sii")?.id).toBe("connect-sii");
    expect(stepByRoute("/onboarding/conectar-sii/detalle")?.id).toBe("connect-sii");
    expect(stepByRoute("/otra-cosa")).toBeUndefined();
  });

  it("progressPct: 1/7 ≈ 14, último = 100", () => {
    expect(progressPct("signup")).toBe(14);
    expect(progressPct("import")).toBe(100);
  });

  it("nextStep / prevStep en los bordes", () => {
    expect(prevStep("signup")).toBeNull();
    expect(nextStep("signup")?.id).toBe("verify-email");
    expect(nextStep("import")).toBeNull();
    expect(prevStep("import")?.id).toBe("opening-balance");
  });

  it("routeAfter: paso intermedio → siguiente; último → dashboard", () => {
    expect(routeAfter("signup")).toBe("/verificar");
    expect(routeAfter("import")).toBe(ONBOARDING_DONE_ROUTE);
  });

  it("stepRouteOrFirst: id conocido → su ruta; desconocido/null → primer post-auth", () => {
    expect(stepRouteOrFirst("industry")).toBe("/onboarding/rubro");
    expect(stepRouteOrFirst("connect-sii")).toBe("/onboarding/conectar-sii");
    expect(stepRouteOrFirst(null)).toBe("/onboarding/conectar-sii"); // primer post-auth
    expect(stepRouteOrFirst("desconocido")).toBe("/onboarding/conectar-sii");
  });
});
