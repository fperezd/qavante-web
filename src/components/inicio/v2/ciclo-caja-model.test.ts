import { describe, it, expect } from "vitest";
import { fraseCicloCaja, mapCicloCaja, statsCicloCaja } from "./ciclo-caja-model";
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

/* Concordancia singular/plural (issue #94): el ejemplo LITERAL del reporte era "Cobras en 1 días"
 * — CCC/DSO/DPO de 1 día es un caso real (una empresa que cobra o paga casi al contado), no de
 * laboratorio. */
describe("fraseCicloCaja — concordancia N=1", () => {
  it("ccc=1 (plata atrapada 1 día): singular 'día', no 'días'", () => {
    const { frase, tono } = fraseCicloCaja(1);
    expect(frase).toBe(
      "Tu plata queda ~1 día atrapada entre que pagas y cobras: financias ese tramo tú.",
    );
    expect(frase).not.toContain("1 días");
    expect(tono).toBe("neg");
  });

  /* [control positivo] mismo signo, N≠1: el gemelo del anterior. Si un mutante forzara siempre el
   * singular, este assert lo mata. */
  it("[control positivo] ccc=5 (plata atrapada varios días): plural 'días'", () => {
    const { frase } = fraseCicloCaja(5);
    expect(frase).toBe(
      "Tu plata queda ~5 días atrapada entre que pagas y cobras: financias ese tramo tú.",
    );
  });

  it("ccc=-1 (1 día de aire): singular 'día', no 'días'", () => {
    const { frase, tono } = fraseCicloCaja(-1);
    expect(frase).toBe(
      "Cobras antes de pagar: tienes ~1 día de aire (tus proveedores te financian).",
    );
    expect(frase).not.toContain("1 días");
    expect(tono).toBe("pos");
  });

  it("[control positivo] ccc=-8 (varios días de aire): plural 'días'", () => {
    const { frase } = fraseCicloCaja(-8);
    expect(frase).toBe(
      "Cobras antes de pagar: tienes ~8 días de aire (tus proveedores te financian).",
    );
  });

  it("ccc=0: frase fija sin número, no pasa por concordancia", () => {
    expect(fraseCicloCaja(0)).toEqual({
      frase: "Cobras y pagas casi al mismo ritmo.",
      tono: "neutral",
    });
  });

  it("ccc=null: degrada honesto, sin número inventado", () => {
    expect(fraseCicloCaja(null)).toEqual({
      frase:
        "Cuando tengamos cobros y pagos con fecha, calculamos cuántos días queda tu plata atrapada.",
      tono: "neutral",
    });
  });
});

describe("statsCicloCaja — el ejemplo LITERAL del issue #94: 'Cobras en 1 días'", () => {
  it("dso=1: sufijo singular 'día' (antes: 'días' fijo, sin importar el valor)", () => {
    const [cobras] = statsCicloCaja(1, 10, 9);
    expect(cobras).toEqual({ label: "Cobras en", valor: "1", sufijo: "día" });
  });

  /* [control positivo] gemelo con N≠1 para el mismo campo. */
  it("[control positivo] dso=10: sufijo plural 'días'", () => {
    const [cobras] = statsCicloCaja(10, 10, 0);
    expect(cobras.sufijo).toBe("días");
  });

  it("dpo=1: sufijo singular 'día'", () => {
    const [, pagas] = statsCicloCaja(10, 1, 9);
    expect(pagas).toEqual({ label: "Pagas en", valor: "1", sufijo: "día" });
  });

  it("ccc=1: sufijo singular 'día'", () => {
    const [, , ciclo] = statsCicloCaja(10, 9, 1);
    expect(ciclo).toEqual({ label: "Ciclo", valor: "1", sufijo: "día" });
  });

  it("ccc=-1: el sufijo concuerda por MAGNITUD ('1 día', no '−1 días')", () => {
    const [, , ciclo] = statsCicloCaja(10, 11, -1);
    expect(ciclo).toEqual({ label: "Ciclo", valor: "-1", sufijo: "día" });
  });

  it("valor null: 'Sin información', sin sufijo (no se inventa un '0 días')", () => {
    const [cobras] = statsCicloCaja(null, 10, 9);
    expect(cobras).toEqual({ label: "Cobras en", valor: "Sin información", sufijo: undefined });
  });
});
