/* Tests de caracterización de formatClp — formateo de pesos chilenos.
   Envuelve Intl.NumberFormat es-CL. Anti-regresión sobre las decisiones
   de formato que importan para mostrar plata: sin decimales, agrupación
   con punto, símbolo $. */
import { describe, expect, it } from "vitest";
import {
  formatClp,
  formatClpBare,
  formatClpFromString,
  formatClpCompact,
  formatMoney,
} from "./clp";

/* Quita cualquier espacio (incluido el NBSP que algunas versiones de ICU
   meten entre símbolo y número) para que los asserts no sean frágiles. */
const norm = (s: string) => s.replace(/\s/g, "");

describe("formatClp", () => {
  it("agrupa los miles con punto y antepone $", () => {
    expect(norm(formatClp(1234))).toBe("$1.234");
    expect(norm(formatClp(1000000))).toBe("$1.000.000");
  });

  it("no muestra decimales (redondea al entero)", () => {
    expect(norm(formatClp(1234.56))).toBe("$1.235");
    expect(formatClp(1234.56)).not.toContain(",");
  });

  it("formatea el cero", () => {
    expect(norm(formatClp(0))).toBe("$0");
  });

  it("negativos: menos tipográfico (−) antes del símbolo → −$5.000", () => {
    const out = norm(formatClp(-5000));
    expect(out).toBe("−$5.000");
    expect(out).toContain("−"); // U+2212, no el guion ASCII
    expect(out.startsWith("−$")).toBe(true);
  });

  it("no genera −$0 cuando el valor redondea a cero", () => {
    expect(norm(formatClp(-0.4))).toBe("$0");
    expect(norm(formatClp(-0))).toBe("$0");
  });

  it("...pero si la magnitud SÍ redondea a un peso, el menos aparece", () => {
    /* `Math.round(-0.5)` da −0 (manda las mitades hacia +∞) mientras Intl redondea
       la magnitud alejándose del cero: decidir el signo con el valor CON signo
       rendía "$1" sobre medio peso negativo. Mismo bug que en `formatPct`. */
    expect(norm(formatClp(-0.5))).toBe("−$1");
  });

  it("no-finito (NaN/Infinity) → guion, NO $NaN/$∞", () => {
    expect(formatClp(NaN)).toBe("s/d");
    expect(formatClp(Infinity)).toBe("s/d");
    expect(formatClp(-Infinity)).toBe("s/d");
  });
});

/* El cuarto sitio del bug de signo sub-peso. `Math.round(-1.5)` da −1 (las mitades van
   hacia +∞), así que la grilla del Estado de Resultados escribía −1 donde `formatClp`
   escribía −$2 sobre el MISMO valor: no era sólo el signo, era la magnitud. */
describe("formatClpBare — mitades negativas", () => {
  it("redondea la magnitud, igual que formatClp", () => {
    expect(formatClpBare(-1.5)).toBe("−2");
    expect(formatClpBare(1.5)).toBe("2");
  });

  it("el cero sigue siendo '0', nunca '−0'", () => {
    expect(formatClpBare(-0.4)).toBe("0");
    expect(formatClpBare(-0.5)).toBe("−1"); // magnitud 0,5 → 1, con signo
  });
});

describe("formatClpCompact", () => {
  it("millones → $X,XM (una decimal, coma es-CL)", () => {
    expect(norm(formatClpCompact(1_200_000))).toBe("$1,2M");
    expect(norm(formatClpCompact(12_300_000))).toBe("$12,3M");
    expect(norm(formatClpCompact(1_000_000))).toBe("$1M");
  });

  it("redondea a la DÉCIMA de millón: 1.150.000 es $1,2M, no $1,1M", () => {
    /* Es el redondeo que decide la cifra visible del eje de la cascada de Caja.
       Sin este test, cambiar `Math.round(abs / 100_000) / 10` por `abs / 1_000_000`
       no rompía nada y la etiqueta se movía sola. */
    expect(norm(formatClpCompact(1_150_000))).toBe("$1,2M");
    expect(norm(formatClpCompact(1_140_000))).toBe("$1,1M");
    expect(norm(formatClpCompact(1_234_567_890))).toBe("$1.234,6M");
  });

  it("miles → $XK (redondea)", () => {
    expect(norm(formatClpCompact(980_000))).toBe("$980K");
    expect(norm(formatClpCompact(1_500))).toBe("$2K");
  });

  it("bajo mil → cae al exacto (formatClp)", () => {
    expect(norm(formatClpCompact(999))).toBe("$999");
    expect(norm(formatClpCompact(0))).toBe("$0");
  });

  it("negativos: menos tipográfico antes del símbolo", () => {
    expect(norm(formatClpCompact(-1_200_000))).toBe("−$1,2M");
    expect(norm(formatClpCompact(-980_000))).toBe("−$980K");
    // Sub-peso: hereda el signo corregido de `formatClp` (antes rendía "$1").
    expect(norm(formatClpCompact(-0.5))).toBe("−$1");
  });

  it("no-finito → guion", () => {
    expect(formatClpCompact(NaN)).toBe("s/d");
    expect(formatClpCompact(Infinity)).toBe("s/d");
  });
});

describe("formatMoney", () => {
  it("CLP: punto de miles, sin decimales (igual que formatClp)", () => {
    expect(norm(formatMoney(1234567, "CLP"))).toBe("$1.234.567");
    expect(norm(formatMoney(1234567, "clp"))).toBe("$1.234.567");
    expect(norm(formatMoney(-300000, "CLP"))).toBe("−$300.000");
  });

  it("USD: símbolo US$, punto de miles, coma decimal, DOS decimales", () => {
    expect(norm(formatMoney(19, "USD"))).toBe("US$19,00");
    expect(norm(formatMoney(1234.5, "USD"))).toBe("US$1.234,50");
    expect(norm(formatMoney(-270.4, "USD"))).toBe("−US$270,40");
  });

  it("moneda ausente → CLP por defecto", () => {
    expect(norm(formatMoney(1000, null))).toBe("$1.000");
    expect(norm(formatMoney(1000, undefined))).toBe("$1.000");
  });

  it("moneda desconocida no rompe (formato genérico con 2 decimales)", () => {
    expect(norm(formatMoney(1234.5, "XXX"))).toContain("1.234,50");
  });

  it("moneda vacía '' → CLP (no RangeError de Intl)", () => {
    expect(norm(formatMoney(1000, ""))).toBe("$1.000");
  });

  it("no-finito → guion", () => {
    expect(formatMoney(NaN, "CLP")).toBe("s/d");
    expect(formatMoney(Infinity, "USD")).toBe("s/d");
  });
});

describe("formatClpBare", () => {
  it("sin símbolo, miles con punto (celda de EERR)", () => {
    expect(formatClpBare(18500000)).toBe("18.500.000");
    expect(formatClpBare(1234.6)).toBe("1.235"); // redondea al peso
  });

  it("el 0 se muestra '0': un cero es un valor REAL, no dato faltante", () => {
    expect(formatClpBare(0)).toBe("0");
    expect(formatClpBare(-0.4)).toBe("0"); // nunca "−0"
  });

  it("negativos con el menos tipográfico U+2212", () => {
    expect(formatClpBare(-300000)).toBe("−300.000");
  });

  it("`signed: false` rinde la MAGNITUD (el signo lo pone la sección)", () => {
    expect(formatClpBare(-300000, { signed: false })).toBe("300.000");
    expect(formatClpBare(300000, { signed: false })).toBe("300.000");
  });

  it("no-finito → 's/d', nunca 'NaN'", () => {
    expect(formatClpBare(NaN)).toBe("s/d");
    expect(formatClpBare(Infinity)).toBe("s/d");
  });
});

/* SIN `norm()` a propósito. El helper de arriba borra TODO espacio, así que un
   assert normalizado no puede ver la diferencia entre "US$1.234,50" y
   "US$ 1.234,50": el separador que el BO ratificó quedaría sin ningún test que lo
   sostenga. Estos comparan el string crudo, y por eso fijan también el TIPO de
   espacio: **NBSP (U+00A0)**, que es el mismo caracter que ICU ya usa en su propio
   `literal` para EUR/GBP en es-CL, y que además impide que la cifra se parta entre el
   símbolo y el número al final de un renglón. Un espacio normal acá rompe estos tests. */
describe("formatMoney — el separador entre símbolo y número", () => {
  it("USD lleva UN separador (NBSP) entre 'US$' y la cifra", () => {
    expect(formatMoney(1234.5, "USD")).toBe("US$ 1.234,50");
    expect(formatMoney(19, "USD")).toBe("US$ 19,00");
  });

  it("el menos tipográfico va ANTES del símbolo, no entre símbolo y número", () => {
    expect(formatMoney(-270.4, "USD")).toBe("−US$ 270,40");
  });

  it("las demás monedas quedan igual: un solo separador, no dos", () => {
    /* es-CL ya separaba EUR/GBP con un `literal`; la normalización NO debe
       duplicarlo. Este assert es el que muere si alguien concatena el espacio
       en vez de mirar si el locale ya lo puso. */
    expect(formatMoney(1234.5, "EUR")).toBe("EUR 1.234,50");
    expect(formatMoney(1234.5, "GBP")).toBe("GBP 1.234,50");
  });

  it("CLP no lleva separador: sigue pegado al $", () => {
    expect(formatMoney(1234567, "CLP")).toBe("$1.234.567");
  });
});

describe("formatMoney — signo sub-centavo", () => {
  it("un negativo que redondea a un centavo lleva el menos", () => {
    // Mismo bug que `formatClp(-0.5)`, un orden de magnitud más abajo.
    expect(norm(formatMoney(-0.005, "USD"))).toBe("−US$0,01");
    expect(norm(formatMoney(-0.004, "USD"))).toBe("US$0,00");
  });
});

describe("formatClpFromString", () => {
  it("string-decimal → CLP", () => {
    expect(norm(formatClpFromString("1234"))).toBe("$1.234");
  });

  it("lo que NO es número vuelve tal cual — nunca un '$0' inventado", () => {
    expect(formatClpFromString("s/d")).toBe("s/d");
    expect(formatClpFromString("pendiente")).toBe("pendiente");
  });
});
