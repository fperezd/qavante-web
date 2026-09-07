import { describe, expect, it } from "vitest";
import { itemsClasificar } from "./bandeja-v07-model";
import { MOV_DATTATEC, MOV_KAUFMANN, sinClasificar } from "./bandeja-v07-fixtures";
import {
  cuerpoClasificacion,
  cuerpoClasificacionLote,
  referenciaMovimientoInicial,
} from "./bandeja-v07-live";

describe("BandejaV07Live · rutas clásicas", () => {
  it("abre el movimiento pendiente que llega desde /caja/por-clasificar", () => {
    const pendiente = referenciaMovimientoInicial(itemsClasificar(sinClasificar()), MOV_DATTATEC);

    expect(pendiente).toEqual({ id: MOV_DATTATEC, tipo: "clasificar" });
  });

  it("no abre un movimiento que ya no está pendiente", () => {
    const ausente = referenciaMovimientoInicial(itemsClasificar(sinClasificar()), MOV_KAUFMANN);

    expect(ausente).toBeNull();
  });
});

describe("BandejaV07Live · clasificación canónica completa", () => {
  it("la clasificación individual envía tipo canónico y cuenta de gestión", () => {
    expect(cuerpoClasificacion("cuenta-1", "supplier_payment", "  factura 10  ", false)).toEqual({
      management_account_id: "cuenta-1",
      canonical_category: "supplier_payment",
      classification_notes: "factura 10",
      create_rule: false,
    });
  });

  it("el lote incluye ambas dimensiones y conserva la llave idempotente", () => {
    expect(
      cuerpoClasificacionLote(
        ["00000000-0000-4000-8000-000000000001"],
        "00000000-0000-4000-8000-000000000002",
        "payroll_payment",
        "",
        "decision-1",
      ),
    ).toEqual({
      movement_ids: ["00000000-0000-4000-8000-000000000001"],
      management_account_id: "00000000-0000-4000-8000-000000000002",
      canonical_category: "payroll_payment",
      idempotency_key: "decision-1",
    });
  });
});
