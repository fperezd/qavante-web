import { describe, expect, it } from "vitest";
import { badgeDelPulso } from "./pulso-badge-model";

/* La barra superior sale en TODAS las pantallas y lee el MISMO objeto que el anillo del Inicio.
 * Es el publicador más grande del "Estable" inventado (qavante-api#162), y el que ya regresó
 * una vez: la primera versión del arreglo corrigió el anillo y dejó el header diciendo
 * `" · Estable"`, con el aria-label "Pulso de tu empresa: de 100, Estable".
 *
 * El pase §6 midió después que toda la lógica del badge no estaba afirmada por ningún test, y
 * que tres mutantes que reponían el defecto sobrevivían con la suite entera verde. */

describe("cuando la API se abstiene, el badge no dice ni pinta nada tranquilizador", () => {
  it("no dice 'Estable'", () => {
    const b = badgeDelPulso(null, null);
    expect(b.sinDato).toBe(true);
    expect(b.texto).toBe("Sin datos");
    expect(b.texto).not.toContain("Estable");
  });

  it("un score ausente CON estado tampoco se pronuncia", () => {
    // Sin esto, `badgeDelPulso(null, "stable")` imprimia literalmente "null · Estable".
    // `anilloDelPulso` ya trataba las dos ausencias igual; el badge no, y qavante-api#227 vuelve
    // ese `score` nullable, asi que la combinacion pasa a ser alcanzable.
    const b = badgeDelPulso(null, "stable");
    expect(b.sinDato).toBe(true);
    expect(b.texto).toBe("Sin datos");
    expect(b.texto).not.toContain("null");
    expect(b.aria).not.toContain("null");
  });

  it("no queda un score suelto", () => {
    // El `{pulso.score}` null no imprimía nada y dejaba un " · Estable" huérfano.
    expect(badgeDelPulso(null, null).texto).not.toContain("·");
    expect(badgeDelPulso(0, null).texto).toBe("Sin datos");
  });

  it("no se pinta de verde", () => {
    expect(badgeDelPulso(null, null).variant).toBe("info");
    expect(badgeDelPulso(null, null).variant).not.toBe("success");
  });

  it("ni de rojo: 'no sabemos' tampoco es 'está mal'", () => {
    expect(badgeDelPulso(null, null).variant).not.toBe("danger");
  });

  it("y el aria-label lo dice completo, sin el 'de 100' colgando", () => {
    const aria = badgeDelPulso(null, null).aria;
    expect(aria).toBe("Pulso de tu empresa: sin datos suficientes para calcularlo. Ver alertas.");
    // El síntoma exacto que midió el pase: "Pulso de tu empresa: de 100, Estable".
    expect(aria).not.toContain("de 100");
    expect(aria).not.toContain("Estable");
  });
});

describe("EL CONTRAPESO: con un estado real el badge sí se pronuncia", () => {
  /* Sin estas gemelas —cada una con el MISMO valor que su negativa de arriba— "no inventes" se
   * satisface no diciendo nunca nada, y el Pulso es lo primero que se ve en toda la app. */

  it("dice el score y la palabra", () => {
    const b = badgeDelPulso(78, "stable");
    expect(b.sinDato).toBe(false);
    expect(b.texto).toBe("78 · Estable");
    expect(b.aria).toBe("Pulso de tu empresa: 78 de 100, Estable. Ver alertas.");
  });

  it("y usa el color de su estado", () => {
    expect(badgeDelPulso(91, "strong").variant).toBe("success");
    expect(badgeDelPulso(78, "stable").variant).toBe("success");
    expect(badgeDelPulso(45, "weak").variant).toBe("warning");
    expect(badgeDelPulso(12, "critical").variant).toBe("danger");
  });
});

describe("un status FUERA DE CONTRATO es otra cosa que el 'no sé'", () => {
  it("cae en el fallback pero SIGUE pintando un score", () => {
    const b = badgeDelPulso(50, "inventado" as never);
    expect(b.sinDato).toBe(false);
    expect(b.variant).toBe("info");
    // La diferencia con el `null`: acá sí hay un número, y se muestra.
    expect(b.texto).toBe("50 · Estable");
  });
});
