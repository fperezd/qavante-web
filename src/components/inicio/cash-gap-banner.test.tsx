import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CashGapBanner, CashGapCardLine } from "./inicio-ejecutivo-view";

/* Copy del banner de brecha de caja del Inicio (`CashGapBanner`).
 *
 * Por qué existe este test: el banner es la PRIMERA cifra de plata que ve el dueño y el signo
 * decide si lee "tengo un millón" o "debo un millón". Antes sólo lo ejercitaba Storybook, así
 * que mutaciones que INVIERTEN el sentido del texto sobrevivían con la suite en verde.
 *
 * Se renderea con `react-dom/server` (sin browser/DOM): el banner es presentación pura (sólo
 * consume `describeCashGap14d` + `formatClp`), no dispara hooks de datos.
 *
 * ── ORIGEN Y CORRECCIÓN ────────────────────────────────────────────────────────────────────
 * La base de este archivo viene de `cdcfcd68`, empujado el 2026-08-26 a
 * `claude/qavante-web-54-cashgap-test` y nunca abierto como PR (por qué quedó huérfano, se
 * desconoce). Cubría los tres `kind` que existían ENTONCES: `shortfall`, `overdraft` y
 * `declared`.
 *
 * Pero `cdcfcd68` es anterior al #53: en su árbol `describeCashGap14d` todavía no tenía
 * `overdraft_with_dues` (el CASO MIXTO), que es justo la rama que el #54 §1 señala. Su docstring
 * describía la "mutación 1" como `formatClp(gap.projected)` → `formatClp(-gap.projected)` en la
 * rama `overdraft` — otra mutación, no la del issue. Medido sobre el `main` de hoy con SU batería
 * como único test del banner:
 *
 *   `formatClp(-gap.descubierto)` → `formatClp(gap.descubierto)`  (la del #54)  → **SOBREVIVE**
 *   `"Te faltan"` → `"Te sobran"`                                 (la del #54)  → muere
 *   el copy del mixto publica la SUMA de los dos montos                          → **SOBREVIVE**
 *
 * De ahí lo que se agrega acá: el caso mixto y los contrapesos.
 *
 * ── CONTRAPESO ─────────────────────────────────────────────────────────────────────────────
 * Cada afirmación negativa ("no dice X") va con su gemela POSITIVA sobre el MISMO valor o la
 * MISMA regex: un `not.toContain` cuyo patrón no casa nunca pasa siempre, y este repo ya tiene
 * el antecedente medido. */

/** Texto plano del banner (tags fuera, espacios colapsados) para assertear el copy.
 *
 *  Las etiquetas se borran, NO se reemplazan por un espacio como hacía `cdcfcd68`: los montos
 *  van en `<span className="tabular-nums">` y con el espacio la frase salía
 *  `"queda bajo cero: −$1.000.000 , ya contando"` — una coma suelta que nadie ve en pantalla y
 *  que impide afirmar la frase entera. Los espacios reales del copy son `{" "}` explícitos en
 *  el JSX, así que no se pierde ninguno. */
function bannerText(props: { critical: number; projected: number }): string {
  return renderToStaticMarkup(<CashGapBanner {...props} />)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lo mismo para la card "Brecha de caja" del grid, la OTRA superficie del mismo hecho. */
function cardText(props: { critical: number; projected: number }): string {
  return renderToStaticMarkup(<CashGapCardLine {...props} />)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Signo menos tipográfico (U+2212) que usa `formatClp` para los negativos, NO un guion ASCII.
const MINUS = "−";

describe("CashGapBanner — copy del banner de brecha (signo/palabras exactas)", () => {
  it("shortfall: dice 'Te faltan {faltante}' (críticas − caja), no 'Te sobran'", () => {
    // critical 1.000.000 − caja 400.000 ⇒ faltante 600.000 (kind = shortfall).
    const text = bannerText({ critical: 1_000_000, projected: 400_000 });

    expect(text).toContain(
      "Te faltan $600.000 para cubrir tus pagos críticos de los próximos 14 días",
    );
    // Mata la mutación de control "Te faltan" → "Te sobran".
    expect(text).not.toContain("Te sobran");
    expect(text).toContain("Obligaciones críticas $1.000.000 · caja proyectada $400.000");
  });

  it("overdraft: la caja bajo cero se pinta en NEGATIVO (−), nunca en positivo", () => {
    // Sin críticas y caja proyectada bajo cero (kind = overdraft): el número es la caja
    // en rojo, y debe leerse con el menos.
    const text = bannerText({ critical: 0, projected: -300_000 });

    // El titular es donde vive la mutación del signo: debe traer el menos tipográfico.
    expect(text).toContain(`Tu caja proyectada a 14 días está bajo cero: ${MINUS}$300.000`);
    // Mata la mutación del signo en ESTA rama: mostraría "$300.000" (positivo).
    expect(text).not.toContain("bajo cero: $300.000");
    // El desglose también reporta la caja con su signo negativo.
    expect(text).toContain(
      `Sin pagos críticos registrados en 14 días · caja proyectada ${MINUS}$300.000`,
    );
  });

  it("declared: hay brecha declarada pero no cuantificable ⇒ ni faltante ni 'bajo cero'", () => {
    // Críticas > 0 pero la caja SÍ las cubre (faltante 0): el backend declaró brecha igual
    // (kind = declared). No inventamos "te faltan $0" ni un descubierto que no existe.
    const text = bannerText({ critical: 1_000_000, projected: 1_000_000 });

    expect(text).toContain("Hay una brecha de caja declarada para los próximos 14 días");
    expect(text).not.toContain("Te faltan");
    expect(text).not.toContain("bajo cero");
    expect(text).toContain("Obligaciones críticas $1.000.000 · caja proyectada $1.000.000");
    /* GEMELAS POSITIVAS de las dos negativas de arriba, con las MISMAS frases: sin esto, un
       cambio de redacción que rompiera "Te faltan" o "bajo cero" en TODAS las ramas dejaría
       estos dos `not` pasando por vacío. */
    expect(bannerText({ critical: 1_000_000, projected: 400_000 })).toContain("Te faltan");
    expect(bannerText({ critical: 0, projected: -300_000 })).toContain("bajo cero");
  });
});

/* ── El CASO MIXTO (`overdraft_with_dues`), que es la rama del #54 ──────────────────────────
 * Caja bajo cero Y obligaciones críticas reales. No existía cuando se escribió `cdcfcd68`.
 * Los montos NO se suman: `projected_cash_14d` se arma acumulando el neto diario, que ya trae
 * esos egresos restados, así que el saldo bajo cero es el que queda DESPUÉS de pagarlas. */
describe("CashGapBanner — el caso mixto: caja bajo cero CON pagos críticos", () => {
  it("nombra las dos cifras, cada una con su apellido, y el saldo en negativo", () => {
    const text = bannerText({ critical: 2_000_000, projected: -1_000_000 });
    expect(text).toContain(
      `En 14 días tu caja proyectada llega a ${MINUS}$1.000.000. Incluye $2.000.000 en pagos que vencen en ese período.`,
    );
    expect(text).toContain(`Obligaciones críticas $2.000.000 · caja proyectada ${MINUS}$1.000.000`);
  });

  it("MUTACIÓN 1 DEL #54 · el descubierto se pinta en NEGATIVO", () => {
    /* `formatClp(-gap.descubierto)` → `formatClp(gap.descubierto)` publica el rojo en positivo.
       La regex es la MISMA para las dos direcciones: casa con o sin el menos y se afirma cuál
       de las dos salió. Un `not.toContain("$1.000.000")` no serviría — `"−$1.000.000"` lo
       contiene como substring y el negativo pasaría siempre. */
    const SALDO = /llega a (−?\$1\.000\.000)/;
    const m = bannerText({ critical: 2_000_000, projected: -1_000_000 }).match(SALDO);
    expect(m?.[1]).toBe(`${MINUS}$1.000.000`); // lo que debe decir
    expect(m?.[1]).not.toBe("$1.000.000"); // lo que decía el mutante, MISMA regex
  });

  it("MUTACIÓN 2 DEL #54 (control preexistente) · el shortfall dice 'faltan', no 'sobran'", () => {
    const VERBO = /Te (faltan|sobran) \$3\.000\.000/;
    const m = bannerText({ critical: 5_000_000, projected: 2_000_000 }).match(VERBO);
    expect(m?.[1]).toBe("faltan");
    expect(m?.[1]).not.toBe("sobran"); // MISMA regex: casa con las dos, sólo una es correcta
  });
});

/* ── Invariantes de honestidad del copy (cada negativa con su gemela positiva) ──────────── */
describe("CashGapBanner — lo que el copy NO puede decir", () => {
  it("el caso mixto NO publica la SUMA de los dos montos", () => {
    /* Con críticas $2M y caja −$1M hay que conseguir $1M, no $3M: sumarlos es doble conteo y
       el banner pediría más plata de la que hace falta. */
    expect(bannerText({ critical: 2_000_000, projected: -1_000_000 })).not.toContain("$3.000.000");
    // GEMELA POSITIVA con el MISMO valor: cuando $3.000.000 SÍ es la cifra, el banner la dice.
    expect(bannerText({ critical: 5_000_000, projected: 2_000_000 })).toContain("$3.000.000");
  });

  it("UN PESO de obligaciones no arrastra $5.000.000 al apellido de los pagos críticos", () => {
    /* El caso que motivó el #53: `criticas − proyectada` = 5.000.001 con UN PESO de pagos
       críticos, publicado como "Te faltan $5.000.001 para cubrir tus pagos críticos". */
    const text = bannerText({ critical: 1, projected: -5_000_000 });
    expect(text).not.toContain("$5.000.001");
    expect(text).not.toContain("para cubrir tus pagos críticos");
    // GEMELAS POSITIVAS: la frase que SÍ corresponde, y la rama que SÍ usa ese apellido.
    expect(text).toContain(
      `llega a ${MINUS}$5.000.000. Incluye $1 en pagos que vencen en ese período.`,
    );
    expect(bannerText({ critical: 5_000_000, projected: 2_000_000 })).toContain(
      "para cubrir tus pagos críticos",
    );
  });

  it("la rama mixta publica el monto con signo negativo y la positiva no", () => {
    expect(bannerText({ critical: 2_000_000, projected: -1_000_000 })).toContain(
      `${MINUS}$1.000.000`,
    );
    expect(bannerText({ critical: 0, projected: -3_935_682 })).toContain("bajo cero");
    expect(bannerText({ critical: 5_000_000, projected: 2_000_000 })).not.toContain(
      `${MINUS}$3.000.000`,
    );
  });

  it("el copy nombra las críticas SÓLO cuando existen ($0 no se menciona)", () => {
    /* Sin este, el kind mixto se satisface devolviéndolo con la caja negativa siempre y el
       copy diría "ya contando los $0 que vencen en ese plazo". */
    expect(bannerText({ critical: 0, projected: -3_935_682 })).not.toContain("ya contando");
    // GEMELA POSITIVA con la MISMA frase: con críticas reales sí se dice.
    expect(bannerText({ critical: 2_000_000, projected: -1_000_000 })).toContain(
      "Incluye $2.000.000 en pagos",
    );
  });

  it("el banner es la puerta a la proyección (el número lleva a la acción)", () => {
    const html = renderToStaticMarkup(
      <CashGapBanner critical={2_000_000} projected={-1_000_000} />,
    );
    expect(html).toContain('href="/caja/proyeccion"');
    expect(html).toContain('role="alert"');
  });
});

/* ── LA OTRA SUPERFICIE: la card "Brecha de caja" del grid ──────────────────────────────────
 *
 * El primer intento de este PR arregló el banner y dejó la card intacta, y el pase §6 lo midió:
 * la mutación del #54 aplicada palabra por palabra a la card SOBREVIVÍA con `--project unit` en
 * 1591 passed y `--project storybook` en 13 passed. O sea que el rojo se podía pintar en
 * positivo en la primera pantalla con todos los gates en verde.
 *
 * `Dashboard` monta las DOS bajo `data.cash_gap`: el banner de ancho completo primero y la card
 * del grid después. No son pantallas alternativas — se leen juntas. */
describe("CashGapCardLine — el mismo hecho en la card del grid", () => {
  it("los cuatro casos, con el saldo en negativo y las palabras", () => {
    expect(cardText({ critical: 5_000_000, projected: 2_000_000 })).toContain(
      "Te faltan $3.000.000 para tus pagos críticos de 14 días.",
    );
    expect(cardText({ critical: 2_000_000, projected: -1_000_000 })).toContain(
      `En 14 días tu caja proyectada llega a ${MINUS}$1.000.000. Incluye $2.000.000 en pagos que vencen en ese período.`,
    );
    expect(cardText({ critical: 0, projected: -3_935_682 })).toContain(
      `Tu caja proyectada a 14 días está bajo cero: ${MINUS}$3.935.682.`,
    );
    expect(cardText({ critical: 5_000_000, projected: 6_000_000 })).toContain(
      "Hay una brecha de caja declarada para los próximos 14 días.",
    );
  });

  it("MUTACIÓN 1 DEL #54, APLICADA A LA CARD · el descubierto se pinta en NEGATIVO", () => {
    /* `formatClp(-gap.descubierto)` → `formatClp(gap.descubierto)`, el mismo cambio de una
       palabra que en el banner. Misma regex en las dos direcciones, por la misma razón: un
       `not.toContain("$1.000.000")` pasaría siempre porque "−$1.000.000" lo contiene. */
    const SALDO = /llega a (−?\$1\.000\.000)/;
    const m = cardText({ critical: 2_000_000, projected: -1_000_000 }).match(SALDO);
    expect(m?.[1]).toBe(`${MINUS}$1.000.000`);
    expect(m?.[1]).not.toBe("$1.000.000");
  });

  it("MUTACIÓN 2 DEL #54, APLICADA A LA CARD · dice 'faltan', no 'sobran'", () => {
    const VERBO = /Te (faltan|sobran) \$3\.000\.000/;
    const m = cardText({ critical: 5_000_000, projected: 2_000_000 }).match(VERBO);
    expect(m?.[1]).toBe("faltan");
    expect(m?.[1]).not.toBe("sobran");
  });

  it("la card tampoco publica la SUMA de los dos montos", () => {
    expect(cardText({ critical: 2_000_000, projected: -1_000_000 })).not.toContain("$3.000.000");
    // GEMELA POSITIVA con el MISMO valor: cuando $3.000.000 SÍ es la cifra, la card la dice.
    expect(cardText({ critical: 5_000_000, projected: 2_000_000 })).toContain("$3.000.000");
  });

  it("la card mixta publica el monto con signo negativo y la positiva no", () => {
    expect(cardText({ critical: 2_000_000, projected: -1_000_000 })).toContain(
      `${MINUS}$1.000.000`,
    );
    expect(cardText({ critical: 0, projected: -3_935_682 })).toContain("bajo cero");
    expect(cardText({ critical: 5_000_000, projected: 2_000_000 })).not.toContain(
      `${MINUS}$3.000.000`,
    );
  });

  it("la card nombra las críticas SÓLO cuando existen ($0 no se menciona)", () => {
    expect(cardText({ critical: 0, projected: -3_935_682 })).not.toContain("ya contando");
    // GEMELA POSITIVA con la MISMA frase.
    expect(cardText({ critical: 2_000_000, projected: -1_000_000 })).toContain(
      "Incluye $2.000.000 en pagos",
    );
  });
});

/* ── LEY 1: las dos superficies de la MISMA pantalla dicen el hecho con las MISMAS palabras ──
 *
 * No basta con que las dos sean ciertas: si el banner dice "queda bajo cero" y la card, a un
 * scroll de distancia, dice "queda en −$X", el dueño tiene que decidir si son el mismo hecho.
 * Estos tests recorren los cuatro casos comparando las dos superficies, así que un copy nuevo
 * que se agregue en una sola de las dos los rompe. */
describe("Banner y card — el mismo hecho, el mismo vocabulario", () => {
  const CASOS = [
    {
      nombre: "shortfall",
      critical: 5_000_000,
      projected: 2_000_000,
      hecho: "Te faltan",
      montosEnCard: 1,
    },
    {
      nombre: "mixto",
      critical: 2_000_000,
      projected: -1_000_000,
      hecho: "En 14 días tu caja proyectada llega a",
      montosEnCard: 2,
    },
    {
      nombre: "overdraft",
      critical: 0,
      projected: -3_935_682,
      hecho: "Tu caja proyectada a 14 días está bajo cero:",
      montosEnCard: 1,
    },
    {
      nombre: "declared",
      critical: 5_000_000,
      projected: 6_000_000,
      hecho: "Hay una brecha de caja declarada para los próximos 14 días",
      montosEnCard: 0,
    },
  ];

  it.each(CASOS)("$nombre: las dos superficies usan la misma frase del hecho", (caso) => {
    const props = { critical: caso.critical, projected: caso.projected };
    expect(bannerText(props)).toContain(caso.hecho);
    expect(cardText(props)).toContain(caso.hecho);
  });

  it.each(CASOS)(
    "$nombre: los montos de la card salen con el MISMO signo que en el banner",
    (caso) => {
      /* El signo es lo que el #54 mide, y lo que no puede diferir entre las dos superficies. No
         se comparan los conjuntos completos: el banner lleva ADEMÁS el subtítulo con el desglose
         ("Obligaciones críticas ... · caja proyectada ...") y la card no, así que la card es un
         SUBCONJUNTO. Lo que se prohíbe es que un mismo monto salga con distinto signo. */
      const props = { critical: caso.critical, projected: caso.projected };
      /* `[\d.]*\d` y no `[\d.]+`: el monto tiene que TERMINAR en dígito. Con `+`, la frase de
         la card "…está bajo cero: −$3.935.682." se llevaba el punto final de la oración dentro
         del monto y comparaba "−$3.935.682." contra "−$3.935.682". Lo encontró este mismo test. */
      const montos = (t: string) => t.match(/−?\$[\d.]*\d/g) ?? [];
      const enCard = montos(cardText(props));
      const enBanner = montos(bannerText(props));
      for (const m of enCard) expect(enBanner).toContain(m);
      /* GEMELO ANTI-VACÍO: un `for` sobre una lista vacía pasa siempre. Se fija cuántos montos
         publica la card en cada caso, así que el bucle de arriba siempre tiene qué comparar
         —salvo en `declared`, que a propósito no publica ninguno, y ahí el 0 es la afirmación. */
      expect(enCard).toHaveLength(caso.montosEnCard);
    },
  );
});
