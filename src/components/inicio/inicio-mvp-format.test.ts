/* Tests de helpers puros del InicioMvpView. La vista React no se testea
   con testing-library (sigue patrón del repo); las stories cubren el
   shell visual. */
import { describe, expect, it } from "vitest";
import { buildGreeting, formatLastLogin } from "./inicio-mvp-format";

describe("buildGreeting", () => {
  it("antes del mediodía → Buenos días", () => {
    const morning = new Date(2026, 4, 28, 9, 0, 0);
    expect(buildGreeting(morning, "Fernando")).toBe("Buenos días, Fernando");
  });

  it("justo a las 12 → Buenas tardes (≥12)", () => {
    const noon = new Date(2026, 4, 28, 12, 0, 0);
    expect(buildGreeting(noon, "Fernando")).toBe("Buenas tardes, Fernando");
  });

  it("a las 18 → Buenas tardes (todavía <19)", () => {
    const lateAfternoon = new Date(2026, 4, 28, 18, 30, 0);
    expect(buildGreeting(lateAfternoon, "Fernando")).toBe("Buenas tardes, Fernando");
  });

  it("a las 19 → Buenas noches", () => {
    const evening = new Date(2026, 4, 28, 19, 0, 0);
    expect(buildGreeting(evening, "Fernando")).toBe("Buenas noches, Fernando");
  });

  it("a la medianoche → Buenos días", () => {
    const midnight = new Date(2026, 4, 28, 0, 0, 0);
    expect(buildGreeting(midnight, "Fernando")).toBe("Buenos días, Fernando");
  });

  it("incluye el displayName tal cual sin alterar (case, espacios)", () => {
    const morning = new Date(2026, 4, 28, 8, 0, 0);
    expect(buildGreeting(morning, "fperez@tooxs.com")).toBe("Buenos días, fperez@tooxs.com");
  });
});

describe("formatLastLogin", () => {
  it("ISO válido → fecha + hora es-CL", () => {
    const out = formatLastLogin("2026-05-28T15:40:13.929323Z");
    /* Output depende de Intl/locale; verificamos solo presencia de los
       componentes mínimos (día, mes abreviado, año). */
    expect(out).toMatch(/\d{2}/); // día
    expect(out).toMatch(/2026/); // año
    expect(out.length).toBeGreaterThan(8);
  });

  it("null → 'Sin registro'", () => {
    expect(formatLastLogin(null)).toBe("Sin registro");
  });

  it("undefined → 'Sin registro'", () => {
    expect(formatLastLogin(undefined)).toBe("Sin registro");
  });

  it("string vacío → 'Sin registro'", () => {
    expect(formatLastLogin("")).toBe("Sin registro");
  });

  it("ISO inválido → fallback al string original", () => {
    expect(formatLastLogin("no-es-fecha")).toBe("no-es-fecha");
  });
});
