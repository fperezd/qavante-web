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
  onboardingResumeRoute,
  routeForSource,
  ONBOARDING_CONNECTIONS_ROUTE,
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

  it("los pasos de conexión declaran su fuente (son los diferibles)", () => {
    expect(stepById("connect-sii")?.source).toBe("sii");
    expect(stepById("connect-bank")?.source).toBe("bank");
    expect(stepById("industry")?.source).toBeUndefined();
    expect(stepById("import")?.source).toBeUndefined();
  });

  it("routeForSource apunta al paso de cada fuente", () => {
    expect(routeForSource("sii")).toBe("/onboarding/conectar-sii");
    expect(routeForSource("bank")).toBe("/onboarding/conectar-banco");
  });

  it("onboardingResumeRoute: reanuda en la primera fuente PENDIENTE", () => {
    expect(onboardingResumeRoute({ sii: "pending", bank: "pending" })).toBe(
      "/onboarding/conectar-sii",
    );
    expect(onboardingResumeRoute({ sii: "connected", bank: "pending" })).toBe(
      "/onboarding/conectar-banco",
    );
    expect(onboardingResumeRoute({ sii: "connected", bank: "connected" })).toBe(
      "/onboarding/rubro",
    );
  });

  it("una fuente DIFERIDA no devuelve al usuario a ese paso ('conectar después' se respeta)", () => {
    // Difirió el SII → el wizard sigue con el banco, no lo empuja de vuelta al SII.
    expect(onboardingResumeRoute({ sii: "deferred", bank: "pending" })).toBe(
      "/onboarding/conectar-banco",
    );
    // Difirió ambas → avanza al resto del wizard. Nada bloquea el registro.
    expect(onboardingResumeRoute({ sii: "deferred", bank: "deferred" })).toBe("/onboarding/rubro");
  });

  it("el hub de conexiones es una ruta del wizard, no un paso numerado", () => {
    expect(ONBOARDING_CONNECTIONS_ROUTE).toBe("/onboarding/conexiones");
    expect(ONBOARDING_STEPS.some((s) => s.route === ONBOARDING_CONNECTIONS_ROUTE)).toBe(false);
  });
});
