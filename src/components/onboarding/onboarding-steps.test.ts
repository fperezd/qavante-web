import { describe, expect, it } from "vitest";
import {
  ONBOARDING_CONNECTIONS_ROUTE,
  ONBOARDING_DONE_ROUTE,
  ONBOARDING_STEP_GROUPS,
  ONBOARDING_STEPS,
  TOTAL_ONBOARDING_GROUPS,
  TOTAL_ONBOARDING_STEPS,
  groupForStep,
  groupIndexForStep,
  groupNumber,
  groupStatus,
  nextStep,
  onboardingResumeRoute,
  prevStep,
  progressPct,
  routeAfter,
  routeBefore,
  routeForSource,
  stepById,
  stepByRoute,
  stepIndex,
  stepNumber,
} from "./onboarding-steps";

describe("onboarding-steps — modelo del wizard", () => {
  it("tiene 14 pasos en orden, ids únicos", () => {
    expect(TOTAL_ONBOARDING_STEPS).toBe(14);
    const ids = ONBOARDING_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      "signup",
      "register-companies",
      "verify-email",
      "choose-plan",
      "import-window",
      "connect-sii",
      "connect-bank",
      "currency",
      "industry",
      "payroll-system",
      "opening-balance",
      "import",
      "activity-start",
      "ready",
    ]);
  });

  it("4 etapas visuales cubren el wizard excepto el cierre (/listo)", () => {
    expect(TOTAL_ONBOARDING_GROUPS).toBe(4);
    const covered = ONBOARDING_STEP_GROUPS.flatMap((g) => g.steps);
    expect(covered).toHaveLength(TOTAL_ONBOARDING_STEPS - 1);
    expect(new Set(covered).size).toBe(TOTAL_ONBOARDING_STEPS - 1);
    expect(groupForStep("signup")?.id).toBe("account");
    expect(groupForStep("choose-plan")?.id).toBe("plan");
    expect(groupForStep("import-window")?.id).toBe("connections");
    expect(groupForStep("connect-bank")?.id).toBe("connections");
    expect(groupForStep("import")?.id).toBe("company-data");
    expect(groupForStep("ready")).toBeUndefined();
    expect(groupNumber("import-window")).toBe(3);
    expect(groupIndexForStep("ready")).toBe(-1);
  });

  it("groupStatus marca done / active / pending", () => {
    const connections = ONBOARDING_STEP_GROUPS.find((g) => g.id === "connections")!;
    expect(groupStatus(connections, stepIndex("signup"))).toBe("pending");
    expect(groupStatus(connections, stepIndex("import-window"))).toBe("active");
    expect(groupStatus(connections, stepIndex("industry"))).toBe("done");
  });

  it("rutas únicas y no vacías", () => {
    const routes = ONBOARDING_STEPS.map((s) => s.route);
    expect(new Set(routes).size).toBe(routes.length);
    for (const r of routes) expect(r.startsWith("/")).toBe(true);
  });

  it("signup, empresas y verify-email son pre-auth; el resto post-auth", () => {
    expect(stepById("signup")?.phase).toBe("pre-auth");
    expect(stepById("register-companies")?.phase).toBe("pre-auth");
    expect(stepById("verify-email")?.phase).toBe("pre-auth");
    expect(stepById("choose-plan")?.phase).toBe("post-auth");
    expect(stepById("import-window")?.phase).toBe("post-auth");
    expect(stepById("connect-sii")?.phase).toBe("post-auth");
    expect(stepById("import")?.phase).toBe("post-auth");
  });

  it("stepIndex / stepNumber", () => {
    expect(stepIndex("signup")).toBe(0);
    expect(stepIndex("register-companies")).toBe(1);
    expect(stepIndex("choose-plan")).toBe(3);
    expect(stepIndex("import-window")).toBe(4);
    expect(stepIndex("currency")).toBe(7);
    expect(stepIndex("import")).toBe(11);
    expect(stepIndex("activity-start")).toBe(12);
    expect(stepIndex("ready")).toBe(13);
    expect(stepNumber("signup")).toBe(1);
    expect(stepNumber("choose-plan")).toBe(4);
    expect(stepNumber("import-window")).toBe(5);
    expect(stepNumber("currency")).toBe(8);
    expect(stepNumber("import")).toBe(12);
    expect(stepNumber("activity-start")).toBe(13);
    expect(stepNumber("ready")).toBe(14);
  });

  it("stepByRoute matchea por ruta exacta y por prefijo", () => {
    expect(stepByRoute("/registro")?.id).toBe("signup");
    expect(stepByRoute("/registro/empresas")?.id).toBe("register-companies");
    expect(stepByRoute("/onboarding/plan")?.id).toBe("choose-plan");
    expect(stepByRoute("/onboarding/mes-inicio")?.id).toBe("import-window");
    expect(stepByRoute("/onboarding/monedas")?.id).toBe("currency");
    expect(stepByRoute("/onboarding/conectar-sii")?.id).toBe("connect-sii");
    expect(stepByRoute("/onboarding/conectar-sii/detalle")?.id).toBe("connect-sii");
    expect(stepByRoute("/otra-cosa")).toBeUndefined();
  });

  it("progressPct: 1/14 ≈ 7, último = 100", () => {
    expect(progressPct("signup")).toBe(7);
    expect(progressPct("ready")).toBe(100);
  });

  it("nextStep / prevStep en los bordes", () => {
    expect(prevStep("signup")).toBeNull();
    expect(nextStep("signup")?.id).toBe("register-companies");
    expect(nextStep("register-companies")?.id).toBe("verify-email");
    expect(nextStep("verify-email")?.id).toBe("choose-plan");
    expect(nextStep("choose-plan")?.id).toBe("import-window");
    expect(nextStep("import-window")?.id).toBe("connect-sii");
    expect(nextStep("connect-bank")?.id).toBe("currency");
    expect(nextStep("currency")?.id).toBe("industry");
    expect(nextStep("import")?.id).toBe("activity-start");
    expect(nextStep("activity-start")?.id).toBe("ready");
    expect(nextStep("ready")).toBeNull();
    expect(prevStep("import")?.id).toBe("opening-balance");
    expect(routeBefore("import")).toBe("/onboarding/saldo-apertura");
    expect(routeBefore("signup")).toBeNull();
    expect(routeAfter("verify-email")).toBe("/onboarding/plan");
  });

  it("routeAfter: paso intermedio → siguiente; último → dashboard", () => {
    expect(routeAfter("signup")).toBe("/registro/empresas");
    expect(routeAfter("register-companies")).toBe("/verificar");
    expect(routeAfter("choose-plan")).toBe("/onboarding/mes-inicio");
    expect(routeAfter("connect-bank")).toBe("/onboarding/monedas");
    expect(routeAfter("currency")).toBe("/onboarding/rubro");
    expect(routeAfter("industry")).toBe("/onboarding/remuneraciones");
    expect(routeAfter("payroll-system")).toBe("/onboarding/saldo-apertura");
    expect(routeAfter("import")).toBe("/onboarding/inicio-de-sociedades");
    expect(routeAfter("activity-start")).toBe("/onboarding/listo");
    expect(routeAfter("ready")).toBe(ONBOARDING_DONE_ROUTE);
  });

  it("los pasos de conexión declaran su fuente (son los diferibles)", () => {
    expect(stepById("connect-sii")?.source).toBe("sii");
    expect(stepById("connect-bank")?.source).toBe("bank");
    expect(stepById("choose-plan")?.source).toBeUndefined();
    expect(stepById("import-window")?.source).toBeUndefined();
    expect(stepById("currency")?.source).toBeUndefined();
    expect(stepById("industry")?.source).toBeUndefined();
    expect(stepById("payroll-system")?.source).toBeUndefined();
    expect(stepById("import")?.source).toBeUndefined();
    expect(stepById("activity-start")?.source).toBeUndefined();
    expect(stepById("ready")?.source).toBeUndefined();
  });

  it("routeForSource apunta al paso de cada fuente", () => {
    expect(routeForSource("sii")).toBe("/onboarding/conectar-sii");
    expect(routeForSource("bank")).toBe("/onboarding/conectar-banco");
  });

  it("onboardingResumeRoute: sin mes guardado → plan (antes de conexiones)", () => {
    expect(
      onboardingResumeRoute({ sii: "pending", bank: "pending" }, { importStartSelected: false }),
    ).toBe("/onboarding/plan");
  });

  it("onboardingResumeRoute: reanuda en la primera fuente PENDIENTE", () => {
    expect(
      onboardingResumeRoute({ sii: "pending", bank: "pending" }, { importStartSelected: true }),
    ).toBe("/onboarding/conectar-sii");
    expect(
      onboardingResumeRoute({ sii: "connected", bank: "pending" }, { importStartSelected: true }),
    ).toBe("/onboarding/conectar-banco");
    expect(
      onboardingResumeRoute({ sii: "connected", bank: "connected" }, { importStartSelected: true }),
    ).toBe("/onboarding/monedas");
  });

  it("una fuente DIFERIDA no devuelve al usuario a ese paso ('conectar después' se respeta)", () => {
    expect(
      onboardingResumeRoute({ sii: "deferred", bank: "pending" }, { importStartSelected: true }),
    ).toBe("/onboarding/conectar-banco");
    expect(
      onboardingResumeRoute({ sii: "deferred", bank: "deferred" }, { importStartSelected: true }),
    ).toBe("/onboarding/monedas");
  });

  it("el hub de conexiones es una ruta del wizard, no un paso numerado", () => {
    expect(ONBOARDING_CONNECTIONS_ROUTE).toBe("/onboarding/conexiones");
    expect(ONBOARDING_STEPS.some((s) => s.route === ONBOARDING_CONNECTIONS_ROUTE)).toBe(false);
  });
});
