import { describe, it, expect } from "vitest";
import { parseSiiErrorBody, classifyDtePreviewError } from "./dte-preview-error";

describe("parseSiiErrorBody", () => {
  it("lee { detail: { code, message } }", () => {
    const body = JSON.stringify({ detail: { code: "sii_session_expired", message: "el SII devolvió HTML" } });
    expect(parseSiiErrorBody(body)).toEqual({ code: "sii_session_expired", message: "el SII devolvió HTML" });
  });

  it("lee { detail: 'texto' }", () => {
    expect(parseSiiErrorBody(JSON.stringify({ detail: "folio inválido" }))).toEqual({
      code: undefined,
      message: "folio inválido",
    });
  });

  it("body no-JSON (HTML) → objeto vacío", () => {
    expect(parseSiiErrorBody("<html><body>Iniciar sesión</body></html>")).toEqual({});
    expect(parseSiiErrorBody("")).toEqual({});
  });
});

describe("classifyDtePreviewError", () => {
  it("sii_session_expired (recibidos) → reconectar certificado", () => {
    const body = JSON.stringify({
      detail: { code: "sii_session_expired", message: "el SII devolvió HTML/login en vez del respaldo XML de recibidos" },
    });
    const out = classifyDtePreviewError(502, "application/json", body);
    expect(out.kind).toBe("sii_session");
    if (out.kind === "sii_session") {
      expect(out.description).toMatch(/Administración → Credenciales/);
    }
  });

  it("dte_not_found con 'listado trajo 0 documentos' → sesión caída (no folio inexistente)", () => {
    const body = JSON.stringify({
      detail: {
        code: "dte_not_found",
        message: "folio 373 no está en el listado de emitidos (el listado trajo 0 documento(s); revisá la sesión/certificado del SII)",
      },
    });
    expect(classifyDtePreviewError(404, "application/json", body).kind).toBe("sii_session");
  });

  it("el SII devuelve HTML (login) → sesión caída", () => {
    expect(classifyDtePreviewError(200, "text/html; charset=utf-8", "<html>…</html>").kind).toBe("sii_session");
  });

  it("dte_not_found de un folio realmente inexistente (sin señal de sesión) → backend crudo", () => {
    const body = JSON.stringify({ detail: { code: "dte_not_found", message: "el folio 999 no existe en el rango consultado" } });
    const out = classifyDtePreviewError(404, "application/json", body);
    expect(out.kind).toBe("backend");
    if (out.kind === "backend") expect(out.description).toMatch(/no existe en el rango/);
  });

  it("sin cuerpo ni pistas → genérico", () => {
    expect(classifyDtePreviewError(500, "application/octet-stream", "").kind).toBe("generic");
  });
});
