import { describe, it, expect } from "vitest";
import { mapCicloCaja } from "./ciclo-caja-model";
import type { CashCycleResponse } from "@/lib/api/treasury";

/* Modelo Ciclo de caja: expone DSO/DPO/CCC tal cual del backend (no recalcula). */

function resp(dso: number | null, dpo: number | null, ccc: number | null): CashCycleResponse {
  return { dso_days: dso, dpo_days: dpo, ccc_days: ccc } as unknown as CashCycleResponse;
}

describe("mapCicloCaja", () => {
  it("mapea dso/dpo/ccc", () => {
    const r = mapCicloCaja(resp(45, 30, 15));
    expect(r).toEqual({ dso: 45, dpo: 30, ccc: 15 });
  });

  it("conserva ccc negativo (cobra antes de pagar)", () => {
    const r = mapCicloCaja(resp(20, 35, -15));
    expect(r!.ccc).toBe(-15);
  });

  it("permite nulls parciales (dpo desconocido)", () => {
    const r = mapCicloCaja(resp(45, null, null));
    expect(r).toEqual({ dso: 45, dpo: null, ccc: null });
  });

  it("null si no vino ningún día", () => {
    expect(mapCicloCaja(resp(null, null, null))).toBeNull();
    expect(mapCicloCaja(undefined)).toBeNull();
  });
});
