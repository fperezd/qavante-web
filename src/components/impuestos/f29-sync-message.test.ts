import { describe, it, expect } from "vitest";
import { isSiiHtmlInsteadOfPdf, f29SyncFailureToast } from "./f29-sync-message";

const htmlInsteadOfPdf = {
  error: "F29NotFoundError",
  detail: "response no es PDF (content-type=text/html;charset=ISO-8859-1); probable folio inexistente o cod_int inválido",
};

describe("isSiiHtmlInsteadOfPdf", () => {
  it("detecta el patrón F29NotFoundError + 'no es PDF' / text/html", () => {
    expect(isSiiHtmlInsteadOfPdf(htmlInsteadOfPdf)).toBe(true);
  });

  it("no matchea otros errores del backend", () => {
    expect(isSiiHtmlInsteadOfPdf({ error: "F29ParseError", detail: "no se pudo parsear" })).toBe(
      false,
    );
    expect(isSiiHtmlInsteadOfPdf({ error: "identity_mismatch", detail: "rut distinto" })).toBe(
      false,
    );
  });

  it("es seguro con null", () => {
    expect(isSiiHtmlInsteadOfPdf(null)).toBe(false);
  });
});

describe("f29SyncFailureToast", () => {
  it("da mensaje accionable (reconectar SII) para el patrón HTML-en-vez-de-PDF, sin ocultar el hecho", () => {
    const { title, description } = f29SyncFailureToast(64, htmlInsteadOfPdf);
    expect(title).toBe("El SII no entregó tus F29");
    // El hecho real sigue presente (página web en vez de PDF).
    expect(description).toMatch(/página web en vez de los PDF/i);
    // Con la acción concreta.
    expect(description).toMatch(/Administración → Credenciales/);
    expect(description).toContain("64 folios");
  });

  it("deja el detalle CRUDO del backend visible para errores desconocidos", () => {
    const detail = { error: "F29FetchError", detail: "timeout al SII" };
    const { title, description } = f29SyncFailureToast(3, detail);
    expect(title).toBe("3 F29 fallaron al bajar");
    expect(description).toBe("F29FetchError: timeout al SII");
  });

  it("singular/plural y sin detalle", () => {
    expect(f29SyncFailureToast(1, null).title).toBe("1 F29 falló al bajar");
    expect(f29SyncFailureToast(2, null).description).toMatch(/rechazó algunos folios/i);
  });

  it("agrega la nota de requests fallidas", () => {
    const { description } = f29SyncFailureToast(64, htmlInsteadOfPdf, " (1 año no respondió)");
    expect(description).toContain("(1 año no respondió)");
  });
});
