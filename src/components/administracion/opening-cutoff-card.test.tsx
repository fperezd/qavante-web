import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OpeningCutoffCardView } from "./opening-cutoff-card";

const noop = vi.fn();

function render(props: Partial<React.ComponentProps<typeof OpeningCutoffCardView>> = {}): string {
  return renderToStaticMarkup(
    <OpeningCutoffCardView
      cutoffDate="2026-06-30"
      onCutoffDateChange={noop}
      onPreview={noop}
      onApply={noop}
      onRevert={noop}
      onRetry={noop}
      {...props}
    />,
  );
}

describe("OpeningCutoffCardView", () => {
  it("explica que el corte conserva historia y no inventa conciliaciones", () => {
    const html = render();
    expect(html).toContain("El historial anterior se conserva");
    expect(html).toContain("no crea clasificaciones ni conciliaciones ficticias");
    expect(html).toContain("Tampoco presume pagadas");
    expect(html).toContain("Previsualizar impacto");
    expect(html).not.toContain("Aplicar este corte");
  });

  it("muestra el impacto antes de habilitar la aplicación", () => {
    const html = render({
      preview: {
        receivables_saldadas: 12,
        payables_saldadas: 8,
        movimientos_clasificacion_retirados: 103,
        movimientos_conciliacion_retirados: 3,
      },
    });
    expect(html).toContain("126 cambios de flujo previstos");
    expect(html).toContain("no registros únicos");
    expect(html).toContain("103");
    expect(html).toContain("Aplicar este corte");
  });

  it("muestra estado activo y permite deshacer", () => {
    const html = render({
      status: {
        configured: true,
        active: true,
        cutoff_date: "2026-06-30",
        applied_at: "2026-09-06T12:00:00Z",
      },
    });
    expect(html).toContain("Historial operativo cerrado hasta el 30-06-2026");
    expect(html).toContain("Deshacer corte");
    expect(html).not.toContain("Previsualizar impacto");
  });
});
