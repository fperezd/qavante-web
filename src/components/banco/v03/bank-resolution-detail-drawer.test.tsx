import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BankResolutionDetailDrawer } from "./bank-resolution-detail-drawer";
import type { BankMovementResolutionDetail } from "./bank-resolution-detail-model";
import type { MovimientoV03 } from "./banco-v03-model";

const movement: MovimientoV03 = {
  id: "m1",
  bankAccountId: "account-1",
  fecha: "2026-09-07",
  glosa: "Transferencia de ejemplo",
  monto: -100_000,
  moneda: "CLP",
  esAbono: false,
  cuenta: "CC CLP",
  categoria: "Remuneraciones",
  estadoConciliacion: "conciliado",
  estadoClasificacion: "clasificado",
  porConciliar: false,
};

function detail(
  dimensions: Array<{ name: string; value: string }> = [],
): BankMovementResolutionDetail {
  return {
    movementId: "m1",
    reconciliation: {
      status: "conciliado",
      topology: "1:1",
      allocations: [
        {
          id: "doc-1",
          label: "Nómina septiembre",
          kind: "document",
          amountFormatted: "$100.000",
        },
      ],
    },
    classification: {
      status: "clasificado",
      canonicalType: "Pago de remuneraciones",
      allocations: [
        {
          id: "allocation-1",
          label: "Remuneraciones administración",
          kind: "classification",
          amountFormatted: "$100.000",
          dimensions,
        },
      ],
    },
  };
}

function html(value: BankMovementResolutionDetail) {
  return renderToStaticMarkup(
    <BankResolutionDetailDrawer
      open
      movement={movement}
      detail={value}
      onClose={vi.fn()}
      onUnreconcile={vi.fn()}
      onReclassify={vi.fn()}
      onUnclassify={vi.fn()}
    />,
  );
}

describe("BankResolutionDetailDrawer", () => {
  it("muestra ambos ejes, origen/aplicación y acciones reversibles", () => {
    const rendered = html(detail());
    expect(rendered).toContain("Conciliación");
    expect(rendered).toContain("Clasificación");
    expect(rendered).toContain("Nómina septiembre");
    expect(rendered).toContain("Remuneraciones administración");
    expect(rendered).toContain("Desconciliar");
    expect(rendered).toContain("Modificar clasificación");
    expect(rendered).toContain("Desclasificar");
  });

  it("no muestra dimensiones si el read model no trae dimensiones activas", () => {
    expect(html(detail())).not.toContain("Centro de costo");
    expect(html(detail([{ name: "Centro de costo", value: "Operaciones" }]))).toContain(
      "Centro de costo: Operaciones",
    );
  });
});
