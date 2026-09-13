import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MesaSugerencias, MovimientosDetalle } from "./movimientos-detalle";
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

const completeSuggestion: SugerenciaConciliacion = {
  movementId: movement.id!,
  movimiento: {
    fecha: "2026-08-30",
    monto: -254_250,
    direccion: "debit",
    moneda: "USD",
    glosa: "Snapshot canónico del movimiento",
    completo: true,
  },
  kind: "payable",
  nombre: "Proveedor SpA",
  score: 92,
  documentCount: 1,
  topology: "1:1",
  reasons: ["RUT en glosa", "monto exacto"],
  eligibility: ["same_currency", "open_balance", "feasible_date"],
  canConfirm: true,
  bulkEligible: true,
  documents: [
    {
      documentId: "doc-1",
      kind: "payable",
      documentType: 33,
      folio: "101",
      rut: "76123456-7",
      nombre: "Proveedor SpA",
      monto: 254_250,
      fecha: "2026-08-20",
      vencimiento: "2026-09-20",
      sourceProvider: "sii_rcv",
    },
  ],
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
    const html = renderWithSuggestion(completeSuggestion);

    expect(html).toContain("Por conciliar");
    expect(html).toContain("Sin clasificar");
    expect(html).toContain("Posible pago a");
    expect(html).toContain("Proveedor SpA");
    expect(html).toContain("Conciliar");
    // Los dos estados son información de resolución, no metadatos de escritorio:
    // deben seguir presentes en móvil y no quedar ocultos detrás de `sm`.
    expect(html).not.toContain("hidden sm:flex");
  });

  it("presenta movimiento, respaldo, evidencia y lote en la mesa comparativa", () => {
    const html = renderToStaticMarkup(
      <MesaSugerencias
        movimientos={[movement]}
        sugerencias={new Map([[movement.id!, completeSuggestion]])}
        subtitulo="07-04222-1 · BICE"
        onConciliar={vi.fn()}
        onRechazar={vi.fn()}
        onConciliarLote={vi.fn()}
        loteEnCurso={false}
      />,
    );

    expect(html).toContain("Movimiento bancario");
    expect(html).toContain("Documentos de respaldo");
    expect(html).toContain("Proveedor SpA");
    expect(html).toContain("Folio 101");
    expect(html).toContain("RUT en glosa");
    expect(html).toContain("Conciliar todas (1)");
    expect(html).toContain("Snapshot canónico del movimiento");
    expect(html).toContain("30-08-2026");
    expect(html).toContain("US$");
    expect(html).not.toContain("Transf. a terceros vía Internet");
  });

  it("nunca presenta s/d como contraparte ni permite conciliarla directamente", () => {
    const html = renderWithSuggestion({
      movementId: movement.id!,
      movimiento: {
        fecha: null,
        monto: null,
        direccion: null,
        moneda: null,
        glosa: null,
        completo: false,
      },
      kind: "payable",
      nombre: null,
      score: null,
      documentCount: null,
      topology: null,
      reasons: [],
      eligibility: [],
      canConfirm: false,
      bulkEligible: false,
      documents: [],
    });

    expect(html).not.toContain("Pago a s/d");
    expect(html).toContain("Propuesta incompleta: falta identificar la contraparte");
    expect(html).toContain("Revisar");
    expect(html).not.toContain(">Conciliar<");
  });

  it("no atribuye topología ni cantidad a una propuesta con snapshot incompleto", () => {
    const incompleteSuggestion: SugerenciaConciliacion = {
      ...completeSuggestion,
      movimiento: {
        ...completeSuggestion.movimiento,
        moneda: null,
        completo: false,
      },
      documentCount: null,
      topology: null,
      canConfirm: false,
      bulkEligible: false,
      documents: [],
    };
    const html = renderToStaticMarkup(
      <MesaSugerencias
        movimientos={[movement]}
        sugerencias={new Map([[movement.id!, incompleteSuggestion]])}
        loteEnCurso={false}
      />,
    );

    expect(html).toContain("Información del respaldo incompleta");
    expect(html).toContain("El respaldo cambió o ya no está disponible.");
    expect(html).toContain("Datos del movimiento incompletos; no se puede actuar sobre esta propuesta.");
    expect(html).not.toContain("1:1 · 1 respaldo");
    expect(html).toContain("Acción no disponible");
    expect(html).not.toContain("Revisar");
    expect(html).not.toContain("Rechazar");
    expect(html).not.toContain(">Conciliar<");
  });
});
