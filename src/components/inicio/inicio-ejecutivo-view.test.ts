import { describe, expect, it } from "vitest";
import { etiquetaProximoPago } from "./inicio-ejecutivo-view";

describe("etiquetaProximoPago — contrato #254", () => {
  it("llama Próximo sólo al vencimiento que no está vencido", () => {
    const etiqueta = etiquetaProximoPago({
      label: "Proveedor",
      due_date: "2026-09-04",
      amount: "1",
      category: "supplier",
      is_overdue: false,
    });

    expect(etiqueta).toBe("Próximo");
    expect(etiqueta).not.toBe("Estado de vencimiento sin dato");
  });

  it("declara sin dato si falta is_overdue en una respuesta parcial", () => {
    const pagoParcial = {
      label: "Proveedor sin estado",
      due_date: "2026-09-04",
      amount: "1",
      category: "supplier",
    } as unknown as Parameters<typeof etiquetaProximoPago>[0];

    const etiqueta = etiquetaProximoPago(pagoParcial);
    expect(etiqueta).toBe("Estado de vencimiento sin dato");
    expect(etiqueta).not.toBe("Próximo");
  });

  it("declara sin dato si is_overdue no es booleano", () => {
    const pagoInvalido = {
      label: "Proveedor con estado inválido",
      due_date: "2026-09-04",
      amount: "1",
      category: "supplier",
      is_overdue: "false",
    } as unknown as Parameters<typeof etiquetaProximoPago>[0];

    const etiqueta = etiquetaProximoPago(pagoInvalido);
    expect(etiqueta).toBe("Estado de vencimiento sin dato");
    expect(etiqueta).not.toBe("Próximo");
  });

  it("cuando el contrato cae al atraso, no lo publica como próximo", () => {
    expect(
      etiquetaProximoPago({
        label: "Documento atrasado",
        due_date: "2026-08-01",
        amount: "1",
        category: "supplier",
        is_overdue: true,
      }),
    ).toBe("Más vencido");
  });
});
