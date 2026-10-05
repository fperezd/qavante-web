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
  it("tiene 11 pasos en orden, ids únicos", () => {
    expect(TOTAL_ONBOARDING_STEPS).toBe(11);
    const ids = ONBOARDING_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      "signup",
      "verify-email",
      "assign-rut",
      "connect-sii",
      "connect-bank",
      "industry",
      "payroll-system",
      "opening-balance",
      "import",
      "activity-start",
      "ready",
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
    expect(stepIndex("import")).toBe(8);
    expect(stepIndex("activity-start")).toBe(9);
    expect(stepIndex("ready")).toBe(10);
    expect(stepNumber("signup")).toBe(1);
    expect(stepNumber("import")).toBe(9);
    expect(stepNumber("activity-start")).toBe(10);
    expect(stepNumber("ready")).toBe(11);
  });

  it("stepByRoute matchea por ruta exacta y por prefijo", () => {
    expect(stepByRoute("/registro")?.id).toBe("signup");
    expect(stepByRoute("/onboarding/conectar-sii")?.id).toBe("connect-sii");
    expect(stepByRoute("/onboarding/conectar-sii/detalle")?.id).toBe("connect-sii");
    expect(stepByRoute("/otra-cosa")).toBeUndefined();
  });

  it("progressPct: 1/11 = 9, último = 100", () => {
    expect(progressPct("signup")).toBe(9);
    expect(progressPct("ready")).toBe(100);
  });

  it("nextStep / prevStep en los bordes", () => {
    expect(prevStep("signup")).toBeNull();
    expect(nextStep("signup")?.id).toBe("verify-email");
    expect(nextStep("import")?.id).toBe("activity-start");
    expect(nextStep("activity-start")?.id).toBe("ready");
    expect(nextStep("ready")).toBeNull();
    expect(prevStep("import")?.id).toBe("opening-balance");
  });

  it("routeAfter: paso intermedio → siguiente; último → dashboard", () => {
    expect(routeAfter("signup")).toBe("/verificar");
    expect(routeAfter("industry")).toBe("/onboarding/remuneraciones");
    expect(routeAfter("payroll-system")).toBe("/onboarding/saldo-apertura");
    /* `import` ya NO es el último: cierra en la primera decisión, no en el panel. Si
       alguien revierte el paso `ready`, este assert cae y no pasa en silencio. */
    expect(routeAfter("import")).toBe("/onboarding/inicio-de-sociedades");
    expect(routeAfter("activity-start")).toBe("/onboarding/listo");
    expect(routeAfter("ready")).toBe(ONBOARDING_DONE_ROUTE);
  });

  it("los pasos de conexión declaran su fuente (son los diferibles)", () => {
    expect(stepById("connect-sii")?.source).toBe("sii");
    expect(stepById("connect-bank")?.source).toBe("bank");
    expect(stepById("industry")?.source).toBeUndefined();
    /* El sistema de remuneraciones se DECLARA, no se conecta: no es una fuente
       diferible al hub de conexiones (CC-API ADR-0122). */
    expect(stepById("payroll-system")?.source).toBeUndefined();
    expect(stepById("import")?.source).toBeUndefined();
    /* La fecha de inicio se DECLARA, no se conecta: tampoco es una fuente diferible. */
    expect(stepById("activity-start")?.source).toBeUndefined();
    expect(stepById("ready")?.source).toBeUndefined();
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
