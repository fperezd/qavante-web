/* Tests del formateador ÚNICO de porcentajes. Cada `it` fija una de las
   decisiones que antes estaban repartidas en 20 implementaciones ad-hoc. */
import { describe, expect, it } from "vitest";
import { formatPct } from "./pct";

describe("formatPct", () => {
  it("separador decimal COMA, no punto (era el bug de los `toFixed(1)`)", () => {
    expect(formatPct(12.5)).toBe("12,5%");
    expect(formatPct(12.5)).not.toContain(".");
  });

  it("máximo 1 decimal: el segundo se redondea, no se muestra", () => {
    expect(formatPct(12.34)).toBe("12,3%");
    expect(formatPct(12.36)).toBe("12,4%");
  });

  it("SIN mínimo de decimales: un entero se muestra entero, no '12,0%'", () => {
    expect(formatPct(12)).toBe("12%");
    expect(formatPct(0)).toBe("0%");
    expect(formatPct(100)).toBe("100%");
  });

  it("negativos con el menos tipográfico U+2212, igual que formatClp", () => {
    expect(formatPct(-7.1)).toBe("−7,1%");
    expect(formatPct(-7.1)).not.toContain("-"); // nunca el hyphen-minus
  });

  it("`signed` antepone '+' SOLO a los positivos", () => {
    expect(formatPct(18.2, { signed: true })).toBe("+18,2%");
    expect(formatPct(-18.2, { signed: true })).toBe("−18,2%");
    expect(formatPct(0, { signed: true })).toBe("0%");
  });

  it("el signo se decide sobre el valor YA REDONDEADO: 0 mostrado nunca lleva signo", () => {
    // Sin esto, un −0,04 salía "−0%" (o "+0%" con signed): un signo que
    // contradice el número que está al lado.
    expect(formatPct(-0.04)).toBe("0%");
    expect(formatPct(0.03, { signed: true })).toBe("0%");
    expect(formatPct(-0.04, { signed: true })).toBe("0%");
  });

  it("y al revés: si el display SÍ muestra un decimal, el signo lo acompaña", () => {
    // −0,05 se muestra "0,1" (Intl redondea alejándose del cero) y por lo tanto
    // tiene que llevar el "−". Decidir el signo con `Math.round(v * 10)`, que
    // manda las mitades hacia +∞, dejaba "0,1%" sobre un valor negativo.
    expect(formatPct(-0.05)).toBe("−0,1%");
    expect(formatPct(0.05, { signed: true })).toBe("+0,1%");
  });

  it("no se clampa a [0,100]: una pérdida o un +240% se ven como son", () => {
    expect(formatPct(-16.7)).toBe("−16,7%");
    expect(formatPct(240)).toBe("240%");
  });

  it("cuatro cifras: agrupa los miles con punto (es-CL), como los montos", () => {
    /* `toFixed` nunca agrupaba, así que un margen sobre base chica salía "1234.6%".
       No es hipotético: `gestion-v2-map.ts` documenta que el % explota ahí. */
    expect(formatPct(1234.56)).toBe("1.234,6%");
    expect(formatPct(1000)).toBe("1.000%");
    expect(formatPct(-1443)).toBe("−1.443%");
  });

  it("no-finito → 's/d', nunca 'NaN%'", () => {
    expect(formatPct(NaN)).toBe("s/d");
    expect(formatPct(Infinity)).toBe("s/d");
    expect(formatPct(-Infinity)).toBe("s/d");
  });
});
