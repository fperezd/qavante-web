/* Tests del mapping tipo_doc SII → label + familia. La tabla es
   subset documentado del SII; tests aseguran que los códigos más usados
   en PYME chilena mapean correctamente y que el fallback no crashea. */
import { describe, expect, it } from "vitest";
import { TIPO_DOC_FAMILIES, tipoDocMeta } from "./tipo-doc";

describe("tipoDocMeta — codes mapeados (subset PYME)", () => {
  it("33 → Factura Electrónica, family factura", () => {
    const m = tipoDocMeta(33);
    expect(m.label).toBe("Factura Electrónica");
    expect(m.abbr).toBe("FAC-EL");
    expect(m.family).toBe("factura");
  });

  it("34 → Factura Exenta Electrónica (FAC-EE)", () => {
    expect(tipoDocMeta(34).abbr).toBe("FAC-EE");
    expect(tipoDocMeta(34).family).toBe("factura");
  });

  it("39 → Boleta Electrónica (BOL-EL)", () => {
    expect(tipoDocMeta(39).abbr).toBe("BOL-EL");
    expect(tipoDocMeta(39).family).toBe("boleta");
  });

  it("46 → Factura de Compra Electrónica (FAC-C-EL)", () => {
    expect(tipoDocMeta(46).label).toBe("Factura de Compra Electrónica");
    expect(tipoDocMeta(46).family).toBe("factura");
  });

  it("56 → Nota de Débito Electrónica (ND-EL)", () => {
    expect(tipoDocMeta(56).abbr).toBe("ND-EL");
    expect(tipoDocMeta(56).family).toBe("nota");
  });

  it("61 → Nota de Crédito Electrónica (NC-EL)", () => {
    expect(tipoDocMeta(61).abbr).toBe("NC-EL");
    expect(tipoDocMeta(61).family).toBe("nota");
  });

  it("52 → Guía de Despacho Electrónica (GD-EL)", () => {
    expect(tipoDocMeta(52).family).toBe("guia");
  });

  it("110 → Factura de Exportación Electrónica", () => {
    expect(tipoDocMeta(110).abbr).toBe("FAC-EXP-EL");
  });
});

describe("tipoDocMeta — fallbacks", () => {
  it("null → 'Documento' / 'DOC' / 'otro'", () => {
    const m = tipoDocMeta(null);
    expect(m.label).toBe("Documento");
    expect(m.abbr).toBe("DOC");
    expect(m.family).toBe("otro");
  });

  it("undefined → fallback", () => {
    const m = tipoDocMeta(undefined);
    expect(m.label).toBe("Documento");
    expect(m.family).toBe("otro");
  });

  it("NaN → fallback (no crashea)", () => {
    const m = tipoDocMeta(Number.NaN);
    expect(m.family).toBe("otro");
  });

  it("código no mapeado → 'Documento <code>' / 'DOC-<code>' / 'otro'", () => {
    /* Forward-compat: si el SII agrega un código nuevo antes de que
       actualicemos la tabla, no crasheamos — mostramos el código tal cual. */
    const m = tipoDocMeta(999);
    expect(m.label).toBe("Documento 999");
    expect(m.abbr).toBe("DOC-999");
    expect(m.family).toBe("otro");
  });
});

describe("TIPO_DOC_FAMILIES — opciones del filtro", () => {
  it("incluye 'todos' como primera opción + 5 familias canónicas", () => {
    expect(TIPO_DOC_FAMILIES[0]?.value).toBe("todos");
    const families = TIPO_DOC_FAMILIES.map((f) => f.value);
    expect(families).toContain("factura");
    expect(families).toContain("boleta");
    expect(families).toContain("nota");
    expect(families).toContain("guia");
    expect(families).toContain("otro");
  });
});
