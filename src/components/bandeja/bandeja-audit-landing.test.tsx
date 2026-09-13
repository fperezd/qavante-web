import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BandejaAuditLanding } from "./bandeja-audit-landing";

describe("BandejaAuditLanding", () => {
  it("presenta la decisión financiera antes que el detalle de auditoría", () => {
    const html = renderToStaticMarkup(<BandejaAuditLanding />);
    const cajaIndex = html.indexOf("Ver estado de caja");
    const auditIndex = html.indexOf("Calidad y auditoría de movimientos");

    expect(cajaIndex).toBeGreaterThan(-1);
    expect(auditIndex).toBeGreaterThan(cajaIndex);
    expect(html).toContain('href="/caja"');
  });

  it("mantiene los flujos manuales como detalle sin CTA primaria de clasificación", () => {
    const html = renderToStaticMarkup(<BandejaAuditLanding />);

    expect(html).toContain('href="/caja/por-clasificar"');
    expect(html).toContain('href="/caja/clasificados"');
    expect(html).toContain('href="/caja/conciliacion"');
    expect(html).toContain("Ver detalle");
    expect(html).not.toContain("Sólo lo que requiere tu revisión");
    expect(html).not.toMatch(/<button[^>]*>[^<]*Clasificar/i);
    expect(html).not.toMatch(/\b\d+\s+movimientos\b/i);
  });
});
