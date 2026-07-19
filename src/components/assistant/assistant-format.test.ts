import { describe, it, expect } from "vitest";
import { toolLabel, sanitizeAssistantContent } from "./assistant-format";

describe("toolLabel", () => {
  it("mapea tools conocidas a etiqueta legible", () => {
    expect(toolLabel("pulso")).toBe("Pulso");
    expect(toolLabel("caja")).toBe("caja");
    expect(toolLabel("cobranza")).toBe("cobranza");
    expect(toolLabel("forecast")).toBe("caja proyectada");
  });
  it("es case-insensitive y trimea", () => {
    expect(toolLabel("  PULSO ")).toBe("Pulso");
  });
  it("desconocida → el nombre en minúscula (sin exponer estructura)", () => {
    expect(toolLabel("Xyz")).toBe("xyz");
  });
});

describe("sanitizeAssistantContent — defensa en profundidad ADR-0004", () => {
  it("texto limpio → sin cambios (salvo trim)", () => {
    expect(sanitizeAssistantContent("Tu caja proyectada es $4,2M.")).toBe(
      "Tu caja proyectada es $4,2M.",
    );
  });

  it("elimina bloques <thinking>…</thinking> y deja el resto", () => {
    expect(
      sanitizeAssistantContent("<thinking>razono cosas internas</thinking>Tu caja es $4,2M."),
    ).toBe("Tu caja es $4,2M.");
  });

  it("apertura <thinking> SIN cierre → corta hasta el final (no filtra el razonamiento)", () => {
    // Antes quedaba "Hola  fuga" (la prosa colada seguía visible). Ahora falla cerrado.
    expect(sanitizeAssistantContent("Hola <thinking> fuga")).toBe("Hola");
  });

  it("marcador **Thinking:** → elimina el marcador Y su línea de razonamiento, deja la respuesta", () => {
    expect(sanitizeAssistantContent("**Thinking:** interno\nTu resultado mejoró.")).toBe(
      "Tu resultado mejoró.",
    );
    // El caso de fuga real: razonamiento + doble salto + respuesta.
    expect(
      sanitizeAssistantContent("**Thinking:** el cliente debe $2M, sugerir cobrar.\n\nTienes $2M en mora."),
    ).toBe("Tienes $2M en mora.");
    expect(sanitizeAssistantContent("**Thinking:** interno")).toBe("");
  });

  it("es case-insensitive con los marcadores", () => {
    expect(sanitizeAssistantContent("<THINKING>x</THINKING>ok")).toBe("ok");
  });

  it("es idempotente", () => {
    const once = sanitizeAssistantContent("<thinking>a</thinking>Texto.");
    expect(sanitizeAssistantContent(once)).toBe(once);
  });

  it("NO mutila prosa legítima con paréntesis", () => {
    const prosa = "Tu caja (proyectada a 14 días) cubre los pagos críticos.";
    expect(sanitizeAssistantContent(prosa)).toBe(prosa);
  });

  it("null / undefined / vacío → string vacío", () => {
    expect(sanitizeAssistantContent(null)).toBe("");
    expect(sanitizeAssistantContent(undefined)).toBe("");
    expect(sanitizeAssistantContent("")).toBe("");
  });
});
