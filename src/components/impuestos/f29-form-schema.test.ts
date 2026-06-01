/* Tests del schema + helpers del form de consulta F29. Validamos las
   constraints client-side antes de pegarle al backend (regla 16: el
   backend re-valida, pero evitamos viajes innecesarios). */
import { describe, expect, it } from "vitest";
import { F29_FORM_DEFAULTS, f29FormSchema, parseFolio } from "./f29-form-schema";

describe("f29FormSchema — validación de folio", () => {
  it("acepta un folio entero positivo (caso típico SII, 6-12 dígitos)", () => {
    const r = f29FormSchema.safeParse({ folioInput: "1234567890" });
    expect(r.success).toBe(true);
  });

  it("acepta y trimea espacios al lado (paste común de los usuarios)", () => {
    const r = f29FormSchema.safeParse({ folioInput: "  987654  " });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.folioInput).toBe("987654");
    }
  });

  it("rechaza vacío", () => {
    expect(f29FormSchema.safeParse({ folioInput: "" }).success).toBe(false);
    expect(f29FormSchema.safeParse({ folioInput: "   " }).success).toBe(false);
  });

  it("rechaza no-dígitos (letras, signos, decimales)", () => {
    expect(f29FormSchema.safeParse({ folioInput: "abc" }).success).toBe(false);
    expect(f29FormSchema.safeParse({ folioInput: "123abc" }).success).toBe(false);
    expect(f29FormSchema.safeParse({ folioInput: "-100" }).success).toBe(false);
    expect(f29FormSchema.safeParse({ folioInput: "1.5" }).success).toBe(false);
    expect(f29FormSchema.safeParse({ folioInput: "123 456" }).success).toBe(false);
  });

  it("rechaza folio cero (no es válido para el SII)", () => {
    expect(f29FormSchema.safeParse({ folioInput: "0" }).success).toBe(false);
    expect(f29FormSchema.safeParse({ folioInput: "000" }).success).toBe(false);
  });

  it("acepta folio de un solo dígito (>0) — el rango lo controla el backend", () => {
    const r = f29FormSchema.safeParse({ folioInput: "7" });
    expect(r.success).toBe(true);
  });

  it("acepta hasta 15 dígitos (límite de precisión segura)", () => {
    expect(f29FormSchema.safeParse({ folioInput: "123456789012345" }).success).toBe(true);
  });

  it("rechaza folios de 16+ dígitos (Number() los redondearía → folio distinto)", () => {
    // 17 dígitos: Number("12345678901234567") === 12345678901234568 (corrupto).
    expect(f29FormSchema.safeParse({ folioInput: "12345678901234567" }).success).toBe(false);
  });

  it("F29_FORM_DEFAULTS arranca vacío (form no se prefilla)", () => {
    expect(F29_FORM_DEFAULTS.folioInput).toBe("");
  });
});

describe("parseFolio — string → number", () => {
  it("convierte el string validado a number", () => {
    expect(parseFolio("1234567890")).toBe(1234567890);
  });

  it("ignora espacios al lado (defensa secundaria; el schema ya trimea)", () => {
    expect(parseFolio("  42  ")).toBe(42);
  });
});
