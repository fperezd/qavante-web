import { describe, expect, it } from "vitest";
import { itemsClasificar, itemsConciliar } from "./bandeja-v07-model";
import { colaConciliar, MOV_DATTATEC, MOV_KAUFMANN, sinClasificar } from "./bandeja-v07-fixtures";
import {
  cuerpoClasificacion,
  cuerpoClasificacionLote,
  cuerpoReglaDesdePropuesta,
  referenciaMovimientoInicial,
} from "./bandeja-v07-live";

describe("BandejaV07Live · rutas clásicas", () => {
  it("abre el movimiento pendiente que llega desde /caja/por-clasificar", () => {
    const pendiente = referenciaMovimientoInicial(
      "clasificar",
      itemsConciliar(colaConciliar()),
      itemsClasificar(sinClasificar()),
      MOV_DATTATEC,
    );

    expect(pendiente).toEqual({ id: MOV_DATTATEC, tipo: "clasificar" });
  });

  it("no abre un movimiento que ya no está pendiente", () => {
    const ausente = referenciaMovimientoInicial(
      "clasificar",
      itemsConciliar(colaConciliar()),
      itemsClasificar(sinClasificar()),
      MOV_KAUFMANN,
    );

    expect(ausente).toBeNull();
  });

  it("abre la conciliación prioritaria desde /bandeja?tab=conciliar&movimiento=...", () => {
    const pendiente = referenciaMovimientoInicial(
      "conciliar",
      itemsConciliar(colaConciliar()),
      itemsClasificar(sinClasificar()),
      MOV_KAUFMANN,
    );

    expect(pendiente).toEqual({ id: MOV_KAUFMANN, tipo: "conciliar" });
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

  it("crea la regla explícita con la clave canónica propuesta por el backend", () => {
    expect(
      cuerpoReglaDesdePropuesta(
        {
          name: "Auto: contraparte 32667051",
          source_type: "bank_movement",
          condition_field: "description",
          operator: "contains",
          condition_value: "32667051",
          priority: 10,
          confidence: 1,
        },
        "cuenta-honorarios",
        "professional_fees_payment",
      ),
    ).toEqual({
      name: "Auto: contraparte 32667051",
      source_type: "bank_movement",
      condition_field: "description",
      operator: "contains",
      condition_value: "32667051",
      management_account_id: "cuenta-honorarios",
      canonical_category: "professional_fees_payment",
      priority: 10,
      confidence: 1,
    });
  });

  it("rechaza una propuesta incompleta en vez de crear una regla amplia", () => {
    expect(() =>
      cuerpoReglaDesdePropuesta(
        { name: "sin condición", condition_field: "description", operator: "contains" },
        "cuenta-1",
        "operational_expense",
      ),
    ).toThrow(/source_type|condition_value/);
  });
});
