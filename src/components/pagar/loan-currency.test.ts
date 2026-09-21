import { describe, expect, it } from "vitest";
import { parseAmount, principalForApi, retypeAmount, sanitizeAmountInput } from "./loan-currency";

describe("sanitizeAmountInput — notación chilena (punto = miles, coma = decimal)", () => {
  it("el punto de miles NO es decimal: 25.000,50 son veinticinco mil, no veinticinco", () => {
    // Regresión: la primera versión devolvía "25.00" — US$ 24.975,50 evaporados.
    expect(sanitizeAmountInput("25.000,50", "USD")).toBe("25000,50");
    expect(parseAmount("25.000,50", "USD")).toBe(25000.5);
  });

  it("CLP no admite decimales y se come los separadores", () => {
    expect(sanitizeAmountInput("12.000.000", "CLP")).toBe("12000000");
    expect(sanitizeAmountInput("12000000,50", "CLP")).toBe("12000000");
  });

  it("UF admite hasta 4 decimales tras la coma", () => {
    expect(sanitizeAmountInput("1.500,25", "UF")).toBe("1500,25");
    expect(sanitizeAmountInput("1500,123456", "UF")).toBe("1500,1234");
  });

  it("sin coma, tres dígitos tras el punto son miles; otra cantidad es decimal", () => {
    expect(sanitizeAmountInput("1.500", "UF")).toBe("1500");
    expect(sanitizeAmountInput("1500.25", "UF")).toBe("1500,25");
    expect(sanitizeAmountInput("1.500.25", "UF")).toBe("1500,25");
  });

  it("con parte entera 0 el punto sí es decimal (0.500 es medio, no quinientos)", () => {
    expect(sanitizeAmountInput("0.500", "UF")).toBe("0,500");
    expect(parseAmount("0.500", "UF")).toBe(0.5);
  });

  it("preserva el separador recién tecleado para poder seguir escribiendo", () => {
    expect(sanitizeAmountInput("1500,", "UF")).toBe("1500,");
    expect(sanitizeAmountInput("1500.", "UF")).toBe("1500,");
    // …y en CLP no hay decimales que escribir, así que no lo preserva.
    expect(sanitizeAmountInput("1500,", "CLP")).toBe("1500");
  });

  it("descarta letras y símbolos tecleados por error", () => {
    expect(sanitizeAmountInput("US$ 25.000,50", "USD")).toBe("25000,50");
    expect(sanitizeAmountInput("abc", "UF")).toBe("");
  });
});

describe("retypeAmount — cambiar de moneda con el monto ya escrito", () => {
  it("UF → CLP RECORTA los decimales, no los pega (1500,25 UF no son 150.025 pesos)", () => {
    expect(retypeAmount("1500,25", "CLP")).toBe("1500");
    expect(parseAmount(retypeAmount("1500,25", "CLP"), "CLP")).toBe(1500);
  });

  it("UF → USD deja 2 decimales de los 4", () => {
    expect(retypeAmount("1500,1234", "USD")).toBe("1500,12");
  });

  it("CLP → UF no inventa decimales", () => {
    expect(retypeAmount("12000000", "UF")).toBe("12000000");
  });
});

describe("parseAmount — texto a número", () => {
  it("lee el decimal de la UF (control positivo del recorte de arriba)", () => {
    expect(parseAmount("1500,25", "UF")).toBe(1500.25);
  });

  it("vacío o sólo separador → 0 (el formulario lo trata como inválido)", () => {
    expect(parseAmount("", "CLP")).toBe(0);
    expect(parseAmount(",", "UF")).toBe(0);
    expect(parseAmount("1500,", "UF")).toBe(1500);
  });
});

describe("principalForApi — string decimal para el contrato", () => {
  it("CLP sin decimales, UF con 4, USD con 2", () => {
    expect(principalForApi("12.000.000", "CLP")).toBe("12000000");
    expect(principalForApi("1.500,25", "UF")).toBe("1500.2500");
    expect(principalForApi("25.000,5", "USD")).toBe("25000.50");
  });

  it("nunca manda notación científica ni cola binaria de float", () => {
    expect(principalForApi("0,0001", "UF")).toBe("0.0001");
    expect(principalForApi("1.000.000.000", "CLP")).toBe("1000000000");
  });
});

describe("[R2] el estado ya saneado no puede volver a interpretarse", () => {
  it("un decimal de 3 dígitos no se convierte en miles al releerlo", () => {
    // Reproduce el defecto: el form guardaba "1500.250" y de ahí salía 1.500.250 al backend.
    const estado = sanitizeAmountInput("1500,250", "UF");
    expect(parseAmount(estado, "UF")).toBe(1500.25);
    expect(principalForApi(estado, "UF")).toBe("1500.2500");
    expect(retypeAmount(estado, "CLP")).toBe("1500");
  });

  it("sanear lo ya saneado no cambia nada (punto fijo)", () => {
    const casos: Array<[string, "CLP" | "UF" | "USD"]> = [
      ["1500,250", "UF"],
      ["25.000,50", "USD"],
      ["12.000.000", "CLP"],
      ["0,500", "UF"],
      ["1500,", "UF"],
      ["1.500", "UF"],
      ["999,9999", "UF"],
    ];
    for (const [entrada, moneda] of casos) {
      const una = sanitizeAmountInput(entrada, moneda);
      expect(sanitizeAmountInput(una, moneda)).toBe(una);
      // …y el número tampoco se mueve al releer.
      expect(parseAmount(una, moneda)).toBe(parseAmount(entrada, moneda));
    }
  });
});
