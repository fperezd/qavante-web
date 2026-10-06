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
  formatMoneyFromDecimalString,
  formatMoneySinMoneda,
  isNonZeroDecimalString,
  MONEDA_NO_INFORMADA,
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

  /* Acá vivía `it("moneda ausente → CLP por defecto")`, y ese test era el candado del
     defecto B04: fijaba que la ausencia de moneda se rindiera como pesos. Un monto en
     dólares rotulado en pesos es una cifra falsa, y a ~950 pesos por dólar el error es
     de casi mil veces. */
  it("moneda ausente NO se rinde como pesos: la cifra con el rótulo de la moneda que falta", () => {
    expect(norm(formatMoney(1000, null))).toBe(`1.000,00·${MONEDA_NO_INFORMADA.replace(/ /g, "")}`);
    expect(norm(formatMoney(1000, undefined))).toBe(
      `1.000,00·${MONEDA_NO_INFORMADA.replace(/ /g, "")}`,
    );
    // Ningún símbolo de moneda: un símbolo afirma una moneda que acá no se conoce.
    expect(formatMoney(1000, null)).not.toContain("$");
    expect(formatMoney(1000, undefined)).not.toContain("$");
  });

  it("moneda desconocida no rompe (formato genérico con 2 decimales)", () => {
    expect(norm(formatMoney(1234.5, "XXX"))).toContain("1.234,50");
  });

  it("UF: DOS decimales, igual que el resto — ratificado, no cuatro (#325)", () => {
    // Intl no reconoce "UF" como ISO-4217 y cae al genérico; redondea igual que USD/EUR.
    expect(norm(formatMoney(129.1234, "UF"))).toBe("UF129,12");
    expect(norm(formatMoney(1500.25, "UF"))).toBe("UF1.500,25");
    expect(norm(formatMoney(-1500.25, "UF"))).toBe("−UF1.500,25");
  });

  it("moneda vacía o en blanco es ausencia, no CLP (y no RangeError de Intl)", () => {
    expect(formatMoney(1000, "")).not.toContain("$");
    expect(formatMoney(1000, "   ")).toContain(MONEDA_NO_INFORMADA);
  });

  /* GEMELO de B04 — el movimiento en PESOS tiene que seguir siendo pesos y sin decimales.
     Un arreglo que ponga "US$" (o el rótulo de moneda ausente) en todas partes pasa el test
     del dólar y rompe el resto del producto. */
  it("GEMELO: CLP sigue en pesos y sin decimales", () => {
    expect(norm(formatMoney(5862, "CLP"))).toBe("$5.862");
    expect(formatMoney(5862, "CLP")).not.toContain("US$");
    expect(formatMoney(5862, "CLP")).not.toContain(MONEDA_NO_INFORMADA);
  });

  /* GEMELO de B04 — una cifra en dólares con decimales que terminan en CERO no pierde la
     moneda por venir "redonda": `US$5.344` existía en prod como "$5.344". */
  it("GEMELO: USD redondo conserva la moneda y los dos decimales", () => {
    expect(norm(formatMoney(5344, "USD"))).toBe("US$5.344,00");
    expect(norm(formatMoney(5862.3, "USD"))).toBe("US$5.862,30");
  });

  describe("formatMoneySinMoneda", () => {
    it("no redondea al peso (redondear al peso YA sería asumir CLP)", () => {
      expect(norm(formatMoneySinMoneda(5862.3))).toBe(
        `5.862,30·${MONEDA_NO_INFORMADA.replace(/ /g, "")}`,
      );
    });

    it("negativo con el menos tipográfico, y no-finito → guion", () => {
      expect(formatMoneySinMoneda(-270.4)).toContain("−");
      expect(formatMoneySinMoneda(NaN)).toBe("s/d");
    });
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

  it("UF también negativa lleva el menos tipográfico, no el guion ASCII de Intl", () => {
    expect(formatMoney(-1500.25, "UF")).toBe("−UF 1.500,25");
    // Redondea a cero a dos decimales: sin menos.
    expect(formatMoney(-0.001, "UF")).toBe("UF 0,00");
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

  /* Obligaciones (Pagar) recibe `NUMERIC(18,2)`, así que sus montos llegan con dos
     decimales. Este formateador compartido redondea al peso: es la regla CLP del
     módulo. El contraste con el formateador exacto queda fijado acá a propósito,
     para que nadie vuelva a unificarlos sin ver las dos salidas juntas. */
  it("redondea al peso el decimal de dos dígitos, y NO es el formateador exacto", () => {
    expect(norm(formatClpFromString("1140000.00"))).toBe("$1.140.000");
    expect(norm(formatClpFromString("1140000.60"))).toBe("$1.140.001");
    // Gemelo del contraste: el exacto llega al MISMO peso por otro camino, sin
    // pasar por Number(). Se diferencian en que el exacto conserva los dígitos de
    // un entero sobre 2^53; la regla CLP sin decimales es la misma para los dos.
    expect(norm(formatMoneyFromDecimalString("1140000.00", "CLP") ?? "")).toBe("$1.140.000");
    expect(norm(formatMoneyFromDecimalString("1140000.60", "CLP") ?? "")).toBe("$1.140.001");
  });
});

describe("formatMoneyFromDecimalString — contrato Decimal exacto", () => {
  /* Strings REALES medidos el 2026-09-15 contra la proyección productiva de Tooxs
     por el conector MCP. El backend publica `str(Decimal)`, así que un residuo de
     conversión FX llega con doce decimales y un `NUMERIC(18,2)` con ".00". */
  it("aplica la regla CLP al peso sobre los decimales que publica producción", () => {
    expect(formatMoneyFromDecimalString("-31016973.362000000000", "CLP")).toBe("−$31.016.973");
    expect(formatMoneyFromDecimalString("31016973.362000000000", "CLP")).toBe("$31.016.973");
    expect(formatMoneyFromDecimalString("40791386.00", "CLP")).toBe("$40.791.386");
    expect(formatMoneyFromDecimalString("21585664.00", "CLP")).toBe("$21.585.664");
    // Gemelo negativo: ninguna de las cuatro deja caer una coma decimal en pesos.
    for (const raw of [
      "-31016973.362000000000",
      "31016973.362000000000",
      "40791386.00",
      "21585664.00",
    ]) {
      expect(formatMoneyFromDecimalString(raw, "CLP")).not.toContain(",");
    }
  });

  it("redondea media hacia arriba sobre el texto, con acarreo y sin signo en el cero", () => {
    expect(formatMoneyFromDecimalString("1234.56", "CLP")).toBe("$1.235");
    expect(formatMoneyFromDecimalString("1234.44", "CLP")).toBe("$1.234");
    expect(formatMoneyFromDecimalString("999.5", "CLP")).toBe("$1.000");
    expect(formatMoneyFromDecimalString("-999.5", "CLP")).toBe("−$1.000");
    // El acarreo cruza todos los nueves sin pasar por un número.
    expect(formatMoneyFromDecimalString("9999999999999999999.5", "CLP")).toBe(
      "$10.000.000.000.000.000.000",
    );
    // Redondea a cero: el menos desaparece porque la cifra mostrada no es negativa.
    expect(formatMoneyFromDecimalString("-0.4", "CLP")).toBe("$0");
    // Gemelo: desde la mitad ya hay magnitud, y el menos vuelve.
    expect(formatMoneyFromDecimalString("-0.5", "CLP")).toBe("−$1");
  });

  it("preserva enteros fuera de IEEE-754 dígito por dígito", () => {
    expect(formatMoneyFromDecimalString("9007199254740993", "CLP")).toBe("$9.007.199.254.740.993");
    expect(formatMoneyFromDecimalString("9007199254740993", "CLP")).not.toContain(
      "9.007.199.254.740.992",
    );
    // La ruta por Number() sí pierde el último dígito: por eso este formateador existe.
    expect(Number("9007199254740993")).toBe(9007199254740992);
    // Con decimales y redondeo al peso, el entero sigue intacto.
    expect(formatMoneyFromDecimalString("9007199254740993.50", "CLP")).toBe(
      "$9.007.199.254.740.994",
    );
    expect(formatMoneyFromDecimalString("9007199254740993.49", "CLP")).toBe(
      "$9.007.199.254.740.993",
    );
  });

  it("la UF va a dos decimales, igual que el resto — ratificado (#325)", () => {
    expect(formatMoneyFromDecimalString("1500.25", "UF")).toBe("UF 1.500,25");
    // Redondea media hacia arriba, mismo criterio que las demás monedas con centavos.
    expect(formatMoneyFromDecimalString("129.1234", "UF")).toBe("UF 129,12");
    expect(formatMoneyFromDecimalString("129.126", "UF")).toBe("UF 129,13");
  });

  it("conserva el signo negativo y da dos decimales a las monedas con centavos", () => {
    expect(formatMoneyFromDecimalString("-9007199254740993.005", "CLP")).toBe(
      "−$9.007.199.254.740.993",
    );
    expect(formatMoneyFromDecimalString("9007199254740993.50", "USD")).toBe(
      "US$ 9.007.199.254.740.993,50",
    );
    // Dos decimales como `formatMoney`, redondeando con la misma regla.
    expect(formatMoneyFromDecimalString("1234.567", "USD")).toBe("US$ 1.234,57");
    expect(formatMoneyFromDecimalString("1234.564", "USD")).toBe("US$ 1.234,56");
    expect(formatMoneyFromDecimalString("1.999", "USD")).toBe("US$ 2,00");
    expect(formatMoneyFromDecimalString("19.123", "EUR")).toBe("EUR 19,12");
    // Rellena a dos decimales cuando el contrato manda menos dígitos.
    expect(formatMoneyFromDecimalString("19", "EUR")).toBe("EUR 19,00");
  });

  it("trata el cero negativo del contrato como cero, igual que formatClp", () => {
    expect(formatMoneyFromDecimalString("-0", "CLP")).toBe("$0");
    expect(formatMoneyFromDecimalString("-0.00", "CLP")).toBe("$0");
    expect(formatMoneyFromDecimalString("-0", "USD")).toBe("US$ 0,00");
    // En CLP un centavo no llega al peso: se muestra el cero, no un "−$0".
    expect(formatMoneyFromDecimalString("-0.01", "CLP")).toBe("$0");
    // Gemelo con centavos: ahí el menos sí sobrevive, porque la cifra mostrada existe.
    expect(formatMoneyFromDecimalString("-0.01", "USD")).toBe("−US$ 0,01");
    expect(formatMoneyFromDecimalString("-1", "CLP")).toBe("−$1");
  });

  it("no convierte texto inválido en cero y distingue cero exacto de un monto", () => {
    expect(formatMoneyFromDecimalString("pendiente", "CLP")).toBe("pendiente");
    expect(isNonZeroDecimalString("-0.00", "CLP")).toBe(false);
    expect(isNonZeroDecimalString("9007199254740993", "CLP")).toBe(true);
    // Un valor no canónico no se suprime, sea cual sea la moneda.
    expect(isNonZeroDecimalString("pendiente", "CLP")).toBe(true);
    expect(isNonZeroDecimalString("pendiente", "USD")).toBe(true);
  });

  it("juzga cero con la misma regla de MONEDA que la pantalla, no sobre los dígitos crudos", () => {
    // CLP redondea al peso: un residuo sub-peso es "$0" en pantalla y también
    // debe juzgarse cero, para no pintar una fila de cobertura con "· $0".
    expect(isNonZeroDecimalString("0.36", "CLP")).toBe(false);
    expect(isNonZeroDecimalString("0.5", "CLP")).toBe(true);
    /* SIN moneda no se juzga con la regla del peso: el residuo sub-peso cuenta como
       impacto, porque suprimirlo sería haber asumido CLP. */
    expect(isNonZeroDecimalString("0.36", null)).toBe(true);
    // USD/otras monedas redondean a dos decimales, no al peso.
    expect(isNonZeroDecimalString("0.004", "USD")).toBe(false);
    expect(isNonZeroDecimalString("0.005", "USD")).toBe(true);
    // El signo no cambia el juicio: se decide sobre la MAGNITUD redondeada, igual
    // que `formatMoneyFromDecimalString`.
    expect(isNonZeroDecimalString("-0.36", "CLP")).toBe(false);
    expect(isNonZeroDecimalString("-0.5", "CLP")).toBe(true);
    expect(isNonZeroDecimalString("-0.004", "USD")).toBe(false);
    expect(isNonZeroDecimalString("-0.005", "USD")).toBe(true);
    // Un Decimal con muchos más dígitos que los que la pantalla puede mostrar
    // redondea a cero igual que un residuo FX real de #598/#600.
    expect(isNonZeroDecimalString(`0.${"0".repeat(400)}1`, "CLP")).toBe(false);
    // Con un residuo grande, la fila sí es real y se muestra: gemelo positivo.
    expect(isNonZeroDecimalString("8947745.00", "CLP")).toBe(true);
  });
});
