import { describe, expect, it } from "vitest";
import { BANK_MOVEMENTS_LIMIT_MAX } from "@/lib/api/treasury";
import { LIMITE_MOVIMIENTOS, MESES_ALCANCE } from "./banco-v03-live";

/* El cableado de V03, fijado contra el CONTRATO.
 *
 * Antecedente medido (pase §6 del PR #85): `LIMITE_MOVIMIENTOS = 1000` se mandaba como `limit=1000`
 * y el backend acepta hasta 500 (`bank_movements_list.limit.maximum`, `Query(50, ge=1, le=500)`):
 * FastAPI respondía 422 y, con el flag ON, la sección de movimientos caía al estado de error en
 * todos los tenants. Ningún test lo fijaba. Este sí. */

describe("BancoV03Live — el limit que se pide al backend", () => {
  it("no supera el máximo del contrato (un limit mayor es 422 y tumba la sección entera)", () => {
    expect(LIMITE_MOVIMIENTOS).toBeLessThanOrEqual(BANK_MOVEMENTS_LIMIT_MAX);
    expect(LIMITE_MOVIMIENTOS).toBeGreaterThanOrEqual(1);
  });

  it("pide el máximo permitido: menos filas = más 'mostrando N de M' sin motivo", () => {
    expect(LIMITE_MOVIMIENTOS).toBe(BANK_MOVEMENTS_LIMIT_MAX);
  });

  it("el alcance declarado en pantalla es de 3 meses", () => {
    expect(MESES_ALCANCE).toBe(3);
  });
});
