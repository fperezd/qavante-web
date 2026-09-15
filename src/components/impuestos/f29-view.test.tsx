import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { F29Response } from "@/lib/api/sii";
import { F29Result } from "./f29-view";

function response(status: "not_found" | "error", message: string): F29Response {
  return {
    status,
    folio: 1234567890,
    period: { year: 2026, month: 4 },
    rut_base: 76123456,
    estado: null,
    fecha_presentacion: null,
    iva_debito_fiscal: null,
    iva_credito_fiscal: null,
    ppm: null,
    total_a_pagar: null,
    code: "sii_business_error",
    message,
    details: null,
    error: null,
  };
}

describe("F29Result — frontera de mensajes", () => {
  it.each(["not_found", "error"] as const)("no renderiza message libre para %s", (status) => {
    const secreto = "Bearer secret-token SELECT * FROM users /api/internal";
    const html = renderToStaticMarkup(
      <F29Result data={response(status, secreto)} folio={1234567890} />,
    );
    expect(html).not.toContain(secreto);
    expect(html).toContain(status === "not_found" ? "Sin declaración" : "No pudimos consultar");
  });
});
