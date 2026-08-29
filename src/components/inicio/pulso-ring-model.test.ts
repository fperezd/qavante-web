import { describe, expect, it } from "vitest";
import { anilloDelPulso } from "./pulso-ring-model";

describe("anilloDelPulso", () => {
  /* El defecto que este módulo cierra (qavante-api#162).
   *
   * Sin saldo de apertura la API se abstiene: `score: null`, `status: null`. El componente tenía
   * un fallback `?? rec.stable`, así que ese caso pintaba **"Estable" en verde** — la palabra
   * más tranquilizadora del enum. Se midió en producción diciéndolo sobre una caja en
   * −$1.121.250, en la MISMA respuesta que reportaba la brecha y `days_of_cash: 0`.
   *
   * Que el backend se abstenga no alcanza si la pantalla inventa. */

  it("sin estado no dice una palabra tranquilizadora", () => {
    const a = anilloDelPulso(null, null);

    expect(a.sinDato).toBe(true);
    expect(a.label).toBe("Sin datos");
    expect(a.label).not.toBe("Estable");
    expect(a.textClass).not.toContain("success");
  });

  it("sin estado no muestra un cero, que se lee como un pulso pésimo", () => {
    expect(anilloDelPulso(null, null).numero).toBe("—");
    expect(anilloDelPulso(0, null).numero).toBe("—");
  });

  it("un score sin estado tampoco se pronuncia", () => {
    // La API los pone en null a los dos, pero basta con que falte uno para no saber.
    expect(anilloDelPulso(72, null).sinDato).toBe(true);
    expect(anilloDelPulso(null, "strong").sinDato).toBe(true);
  });

  it("EL CONTRAPESO: con estado, el anillo SÍ se pronuncia", () => {
    // Sin este par, "no inventes" se satisface no diciendo nunca nada — y el pulso es el
    // indicador de portada.
    const a = anilloDelPulso(78, "stable");

    expect(a.sinDato).toBe(false);
    expect(a.label).toBe("Estable");
    expect(a.numero).toBe("78");
    expect(a.textClass).toContain("success");
  });

  it("cada estado tiene su color y su palabra", () => {
    expect(anilloDelPulso(95, "strong").label).toBe("Fuerte");
    expect(anilloDelPulso(40, "weak").label).toBe("Débil");
    expect(anilloDelPulso(10, "critical").label).toBe("Crítica");
    expect(anilloDelPulso(10, "critical").textClass).toContain("danger");
  });

  it("un status FUERA DE CONTRATO cae en el fallback y no rompe la pantalla", () => {
    // El backend no valida el enum en runtime. Esto es distinto del `null`, que es el "no sé"
    // declarado: un valor inesperado no debe dejar el anillo sin color ni el label en
    // "undefined".
    const a = anilloDelPulso(50, "inventado" as never);

    expect(a.sinDato).toBe(false);
    expect(a.label).toBe("Estable");
  });

  it("el score se acota a 0-100", () => {
    expect(anilloDelPulso(150, "strong").numero).toBe("100");
    expect(anilloDelPulso(-20, "critical").numero).toBe("0");
  });
});
