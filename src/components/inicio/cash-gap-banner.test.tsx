import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { DashboardSummaryV2 } from "@/lib/api/dashboard";
import { CashGapBanner, CashGapCardLine } from "./inicio-ejecutivo-view";
import type { CashGap14dInput } from "./cash-gap-14d";
import { DEFICIT, NO_DEFICIT } from "./resumen/inicio-resumen.fixtures";

/* Copy del banner de brecha de caja del Inicio (`CashGapBanner`) y de la línea de la card del
 * grid (`CashGapCardLine`): las dos superficies del MISMO hecho.
 *
 * Por qué existe este test: el banner es la PRIMERA cifra de plata que ve el dueño. Antes sólo lo
 * ejercitaba Storybook, así que mutaciones que invierten el sentido del texto sobrevivían con la
 * suite en verde (#54). Se renderea con `react-dom/server` (sin browser/DOM): presentación pura.
 *
 * Lo que fija desde el #296 (D01/D03): el número es `cash_gap_amount_14d` tal cual. Con el
 * fixture canónico (brecha 14M, saldo final −10M, mínimo −14M, críticas 34,8M) la versión
 * anterior publicaba "−$10.000.000" —el saldo final— como si fuera la brecha, y con la caja
 * positiva restaba críticas menos caja. Las tres cifras se muestran cada una con su nombre.
 *
 * CONTRAPESO: cada afirmación negativa ("no dice X") va con su gemela POSITIVA sobre el MISMO
 * valor o la MISMA regex: un `not.toContain` cuyo patrón no casa nunca pasa siempre. */

/** Texto plano (tags fuera, espacios colapsados). Las etiquetas se BORRAN, no se reemplazan por
 *  espacio: los montos van en `<span>` y con el espacio la frase quedaba con comas sueltas. */
function bannerText(summary: CashGap14dInput): string {
  return renderToStaticMarkup(<CashGapBanner summary={summary} />)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cardText(summary: CashGap14dInput): string {
  return renderToStaticMarkup(<CashGapCardLine summary={summary} />)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function con(cash_gap: Partial<NonNullable<DashboardSummaryV2["cash_gap"]>>): DashboardSummaryV2 {
  return { ...DEFICIT, cash_gap: { ...DEFICIT.cash_gap!, ...cash_gap } };
}

// Signo menos tipográfico (U+2212) que usa `formatClp` para los negativos, NO un guion ASCII.
const MINUS = "−";

describe("CashGapBanner — el faltante es la brecha que publica el backend", () => {
  it("con el fixture DEFICIT dice 'Te faltan $14.000.000', no el saldo final ni una resta", () => {
    const text = bannerText(DEFICIT);
    expect(text).toContain(
      "Te faltan $14.000.000 para que tu caja no quede bajo cero en los próximos 14 días",
    );
    // Mata la mutación de control "Te faltan" → "Te sobran".
    expect(text).not.toContain("Te sobran");
  });

  it("MUTACIÓN DEL #296 · el titular NO es el saldo final con el signo cambiado", () => {
    /* MISMA regex para las dos direcciones: casa con cualquier monto después de "Te faltan" y se
       afirma cuál salió. Un `not.toContain("$10.000.000")` pasaría por vacío si el copy cambiara. */
    const TITULAR = /Te faltan (\$[\d.]+)/;
    const m = bannerText(DEFICIT).match(TITULAR);
    expect(m?.[1]).toBe("$14.000.000"); // cash_gap_amount_14d
    expect(m?.[1]).not.toBe("$10.000.000"); // −projected_cash_14d, lo que publicaba antes
    expect(m?.[1]).not.toBe("$44.800.000"); // críticas − saldo final
  });

  it("el desglose nombra las TRES cifras del contrato, cada una con su apellido, sin sumarlas", () => {
    expect(bannerText(DEFICIT)).toContain(
      `Mínimo a 14 días ${MINUS}$14.000.000 · saldo al día 14 ${MINUS}$10.000.000 · pagos críticos $34.800.000`,
    );
  });

  it("con cierre POSITIVO el titular sigue siendo la brecha publicada, no críticas menos caja", () => {
    // críticas 34,8M − caja 5M = 29,8M era lo que publicaba la rama "shortfall". El contrato: 14M.
    const text = bannerText(con({ projected_cash_14d: "5000000" }));
    expect(text).toContain("Te faltan $14.000.000");
    expect(text).not.toContain("$29.800.000");
    expect(text).toContain("saldo al día 14 $5.000.000");
  });

  it("brecha declarada sin monto: lo dice sin inventar un número, y el desglose conserva lo que hay", () => {
    const text = bannerText(con({ cash_gap_amount_14d: "" }));
    expect(text).toContain("Hay una brecha de caja declarada para los próximos 14 días");
    expect(text).not.toContain("Te faltan");
    expect(text).not.toContain("$0");
    expect(text).toContain(`Mínimo a 14 días ${MINUS}$14.000.000`);
    // GEMELA POSITIVA con la MISMA frase: con monto publicado sí se dice "Te faltan".
    expect(bannerText(DEFICIT)).toContain("Te faltan");
  });

  it("una cifra de contexto ausente dice 'Sin dato', no '$0'", () => {
    const text = bannerText(con({ projected_cash_14d: "" }));
    expect(text).toContain("saldo al día 14 Sin dato");
    expect(text).not.toContain("saldo al día 14 $0");
    // GEMELA POSITIVA: con el dato, el mismo rótulo trae el monto.
    expect(bannerText(DEFICIT)).toContain(`saldo al día 14 ${MINUS}$10.000.000`);
  });

  it("sin brecha (cash_gap_amount_14d 0, has_gap false) y sin dato NO rinde nada: no hay 'todo bien' acá", () => {
    expect(bannerText(NO_DEFICIT)).toBe("");
    expect(bannerText(null)).toBe("");
    expect(bannerText({ ...DEFICIT, cash_gap: null, cash_forecast: null })).toBe("");
  });

  it("el banner es la puerta a la proyección (el número lleva a la acción)", () => {
    const html = renderToStaticMarkup(<CashGapBanner summary={DEFICIT} />);
    expect(html).toContain('href="/caja/proyeccion"');
    expect(html).toContain('role="alert"');
  });
});

/* ── LA OTRA SUPERFICIE: la card "Brecha de caja" del grid ──────────────────────────────────
 * Las dos se leen juntas; el número y el vocabulario tienen que ser los mismos. */
describe("CashGapCardLine — el mismo hecho en la card del grid", () => {
  it("dice el mismo número que el banner, con el mismo apellido", () => {
    expect(cardText(DEFICIT)).toContain(
      "Te faltan $14.000.000 para que tu caja no quede bajo cero en 14 días.",
    );
    expect(cardText(con({ cash_gap_amount_14d: "" }))).toContain(
      "Hay una brecha de caja declarada para los próximos 14 días.",
    );
  });

  it("MUTACIÓN DEL #296, APLICADA A LA CARD · no publica el saldo final como brecha", () => {
    const TITULAR = /Te faltan (\$[\d.]+)/;
    const m = cardText(DEFICIT).match(TITULAR);
    expect(m?.[1]).toBe("$14.000.000");
    expect(m?.[1]).not.toBe("$10.000.000");
  });

  it("MUTACIÓN DE CONTROL · dice 'faltan', no 'sobran'", () => {
    const VERBO = /Te (faltan|sobran) \$14\.000\.000/;
    const m = cardText(DEFICIT).match(VERBO);
    expect(m?.[1]).toBe("faltan");
    expect(m?.[1]).not.toBe("sobran"); // MISMA regex: casa con las dos, sólo una es correcta
  });

  it("sin brecha o sin dato no rinde nada", () => {
    expect(cardText(NO_DEFICIT)).toBe("");
    expect(cardText(null)).toBe("");
  });
});
