import { describe, expect, it } from "vitest";
import { todoGestionadoLabel } from "./cobrar-v2-live";

/* Concordancia N=1 — FRASE completa, no sólo el sustantivo (issue #94). Un tenant con 1 solo
 * cliente con saldo, ya gestionado, es el caso real de una cartera chica: el defecto vivo
 * escribía "Marcaste como gestionados a tus 1 clientes con saldo." (gestionados/tus/clientes,
 * los tres en plural sobre un N=1). */
describe("todoGestionadoLabel", () => {
  it("count=1: singular en las TRES palabras que concuerdan (gestionado/tu/cliente)", () => {
    expect(todoGestionadoLabel(1)).toBe("Marcaste como gestionado a tu 1 cliente con saldo.");
    expect(todoGestionadoLabel(1)).not.toContain("gestionados");
    expect(todoGestionadoLabel(1)).not.toContain("tus 1");
    expect(todoGestionadoLabel(1)).not.toContain("1 clientes");
  });

  /* [control positivo] gemelo N≠1: si un mutante forzara siempre el singular, este assert lo mata. */
  it("[control positivo] count=3: plural en las tres", () => {
    expect(todoGestionadoLabel(3)).toBe("Marcaste como gestionados a tus 3 clientes con saldo.");
  });
});
