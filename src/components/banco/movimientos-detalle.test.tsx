import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MovimientosDetalle } from "./movimientos-detalle";
import type { MovimientoBanco, SugerenciaConciliacion } from "./banco-movimientos-model";

const movement: MovimientoBanco = {
  id: "movement-1",
  fecha: "2026-08-31",
  glosa: "Transf. a terceros vía Internet",
  monto: -254_250,
  moneda: "CLP",
  esAbono: false,
  estado: "por_conciliar",
  estadoClasificacion: "por_clasificar",
};

function renderWithSuggestion(suggestion: SugerenciaConciliacion) {
  return renderToStaticMarkup(
    <MovimientosDetalle
      titulo="Cuenta corriente"
      mesActual="2026-09"
      period="2026-08"
      onPeriodChange={vi.fn()}
      movimientos={[movement]}
      conEstado
      conciliarEnabled
      sugerencias={new Map([[movement.id!, suggestion]])}
      onConciliar={vi.fn()}
      onRechazar={vi.fn()}
      onOpenMovement={vi.fn()}
    />,
  );
}

describe("MovimientosDetalle · resolución visible", () => {
  it("muestra conciliación y clasificación como estados independientes", () => {
    const html = renderWithSuggestion({
      movementId: movement.id!,
      kind: "payable",
      nombre: "Proveedor SpA",
      score: 92,
      documentCount: 1,
    });

    expect(html).toContain("Por conciliar");
    expect(html).toContain("Sin clasificar");
    expect(html).toContain("Posible pago a");
    expect(html).toContain("Proveedor SpA");
    expect(html).toContain("Conciliar");
    // Los dos estados son información de resolución, no metadatos de escritorio:
    // deben seguir presentes en móvil y no quedar ocultos detrás de `sm`.
    expect(html).not.toContain("hidden sm:flex");
  });

  it("nunca presenta s/d como contraparte ni permite conciliarla directamente", () => {
    const html = renderWithSuggestion({
      movementId: movement.id!,
      kind: "payable",
      nombre: null,
      score: null,
      documentCount: 1,
    });

    expect(html).not.toContain("Pago a s/d");
    expect(html).toContain("Propuesta incompleta: falta identificar la contraparte");
    expect(html).toContain("Revisar");
    expect(html).not.toContain(">Conciliar<");
  });
});
