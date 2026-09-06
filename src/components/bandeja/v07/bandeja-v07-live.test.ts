import { describe, expect, it } from "vitest";
import { itemsClasificar } from "./bandeja-v07-model";
import { MOV_DATTATEC, MOV_KAUFMANN, sinClasificar } from "./bandeja-v07-fixtures";
import { referenciaMovimientoInicial } from "./bandeja-v07-live";

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
