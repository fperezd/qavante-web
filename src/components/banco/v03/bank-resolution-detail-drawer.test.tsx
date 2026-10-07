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
  contraparte: { nombre: null, rut: null, procedencia: "carga_no_la_mira" },
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
    contraparte: { nombre: null, rut: null, procedencia: "carga_no_la_mira" },
    reconciliation: {
      status: "conciliado",
      canUnreconcile: true,
      topology: "1:1",
      allocations: [
        {
          id: "doc-1",
          label: "Nómina septiembre",
          kind: "document",
          amountFormatted: "$100.000",
        },
      ],
      components: [
        {
          id: "interest:op-77",
          kind: "interest",
          amountFormatted: "−$1.500",
          source: "factoring_settlement",
          sourceReference: "op-77",
          taxTreatment: "exempt",
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
    expect(rendered).toContain("Componentes financieros");
    expect(rendered).toContain("Interés financiero");
    expect(rendered).not.toContain("op-77");
    expect(rendered).toContain("Tratamiento tributario: Exento");
    expect(rendered).not.toContain("exempt");
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

  it("bloquea una reversión que el backend no puede garantizar", () => {
    const unsupported = detail();
    unsupported.reconciliation.canUnreconcile = false;
    const rendered = html(unsupported);
    expect(rendered).toContain("disabled");
    expect(rendered).toContain("no admite una reversión segura");
  });

  it("ofrece conciliación explícita sólo cuando el movimiento sigue pendiente", () => {
    const pending = detail();
    pending.reconciliation.status = "pendiente";
    const rendered = renderToStaticMarkup(
      <BankResolutionDetailDrawer
        open
        movement={{ ...movement, estadoConciliacion: "pendiente", porConciliar: true }}
        detail={pending}
        onClose={vi.fn()}
        onReconcile={vi.fn()}
      />,
    );
    expect(rendered).toContain("Conciliar movimiento");
    expect(rendered).not.toContain("Desconciliar");
  });

  it("declara la carga y el error canónicos sin dejar acciones habilitadas", () => {
    const loading = renderToStaticMarkup(
      <BankResolutionDetailDrawer
        open
        movement={movement}
        detail={detail()}
        resolutionLoading
        onClose={vi.fn()}
        onUnreconcile={vi.fn()}
      />,
    );
    expect(loading).toContain("Cargando el detalle del movimiento");
    expect(loading).not.toContain("Desconciliar");

    const error = renderToStaticMarkup(
      <BankResolutionDetailDrawer
        open
        movement={movement}
        detail={detail()}
        resolutionError={new Error("falló el read model")}
        onRetryResolution={vi.fn()}
        onClose={vi.fn()}
        onUnreconcile={vi.fn()}
      />,
    );
    expect(error).toContain("No pudimos cargar el detalle del movimiento");
    expect(error).not.toContain("Desconciliar");
  });
});

describe("BankResolutionDetailDrawer — con quién fue la plata", () => {
  /* Acá la persona decide con qué documento concilia. Las dos ausencias llevan a búsquedas
     distintas: si el banco no la publica, hay que buscar por monto y fecha; si la carga no la
     mira, puede existir otra carga de la misma cuenta que sí la trae. */
  const conProcedencia = (contraparte: BankMovementResolutionDetail["contraparte"]) =>
    html({ ...detail(), contraparte });

  it("contraparte acreditada: nombre, identificador y la glosa completa, las dos cosas", () => {
    const rendered = conProcedencia({
      nombre: "Cliente Norte SpA",
      rut: "76.123.456-7",
      procedencia: "banco_informo",
    });
    expect(rendered).toContain("Contraparte");
    expect(rendered).toContain("Cliente Norte SpA");
    expect(rendered).toContain("76.123.456-7");
    expect(rendered).toContain("El banco informó el titular de la otra cuenta");
    /* La glosa del movimiento sigue en el panel, entera. */
    expect(rendered).toContain("Transferencia de ejemplo");
  });

  it("EL GEMELO: sin contraparte acreditada el panel DICE cuál ausencia es, y las dos frases difieren", () => {
    const preguntado = conProcedencia({
      nombre: null,
      rut: null,
      procedencia: "banco_no_la_publica",
    });
    const nadiePregunto = conProcedencia({
      nombre: null,
      rut: null,
      procedencia: "carga_no_la_mira",
    });
    expect(preguntado).toContain("Le preguntamos al banco por este movimiento y no publica");
    expect(nadiePregunto).toContain("al banco nunca se le preguntó por él");
    expect(preguntado).not.toContain("nunca se le preguntó");
    expect(nadiePregunto).not.toContain("Le preguntamos al banco");
    /* Y en ninguno de los dos aparece un nombre: sin acreditación no se exhibe identidad. */
    for (const rendered of [preguntado, nadiePregunto]) {
      expect(rendered).not.toContain("Cliente Norte SpA");
      expect(rendered).toContain("Transferencia de ejemplo");
    }
  });
});
