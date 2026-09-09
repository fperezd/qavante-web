import { describe, expect, it } from "vitest";
import { formatDocumentSuggestionAmount } from "./document-suggestions-dialog";

describe("formatDocumentSuggestionAmount", () => {
  it("usa la moneda del movimiento para no publicar un candidato USD como CLP", () => {
    expect(formatDocumentSuggestionAmount("1234.5", "USD")).toBe("US$ 1.234,50");
    expect(formatDocumentSuggestionAmount("1234.5", "CLP")).toBe("$1.235");
  });

  it("declara la moneda desconocida en vez de inventar CLP", () => {
    expect(formatDocumentSuggestionAmount("1234", "S/D")).toBe("1.234 · moneda desconocida");
  });
});
