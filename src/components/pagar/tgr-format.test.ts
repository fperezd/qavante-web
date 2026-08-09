import { describe, it, expect } from "vitest";
import { formularioLabelTgr } from "./tgr-format";

describe("formularioLabelTgr", () => {
  it("mapea los códigos conocidos a lenguaje de dueño", () => {
    expect(formularioLabelTgr("29")).toBe("IVA (mensual)");
    expect(formularioLabelTgr("22")).toBe("Renta (anual)");
    expect(formularioLabelTgr("21")).toBe("PPM");
    expect(formularioLabelTgr("99")).toBe("Multas e intereses");
  });

  it("código desconocido → 'Formulario N'; vacío/null → 's/d'", () => {
    expect(formularioLabelTgr("50")).toBe("Formulario 50");
    expect(formularioLabelTgr(null)).toBe("s/d");
    expect(formularioLabelTgr(undefined)).toBe("s/d");
  });
});
