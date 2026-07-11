/* Tests de los helpers puros del cash-flow report. Anti-regresión contra
   cambios accidentales en el parseo del string-decimal del backend o en
   la traducción del period a label es-CL. */
import { describe, expect, it } from "vitest";
import {
  formatPeriodLabel,
  formatBucketLabel,
  formatPeriodMMYYYY,
  buildMonthOptions,
  isValidPeriod,
  isValidPeriodRange,
  parseDecimal,
  normalizeNet,
} from "./cash-flow-format";

describe("normalizeNet — colapsa -0 y fracciones que redondean a cero (#12)", () => {
  it("fracción negativa que redondea a cero → 0 positivo (no -0)", () => {
    const out = normalizeNet(-0.3);
    expect(out).toBe(0);
    expect(Object.is(out, -0)).toBe(false);
    expect(out < 0).toBe(false); // no se pinta de rojo
  });

  it("-0 exacto → 0 positivo", () => {
    expect(Object.is(normalizeNet(-0), -0)).toBe(false);
    expect(normalizeNet(-0)).toBe(0);
  });

  it("negativo real se preserva (redondeado)", () => {
    expect(normalizeNet(-100.4)).toBe(-100);
    expect(normalizeNet(-0.6)).toBe(-1);
  });

  it("positivo se redondea normal", () => {
    expect(normalizeNet(100.6)).toBe(101);
    expect(normalizeNet(0)).toBe(0);
  });
});

describe("parseDecimal — string decimal del backend a number", () => {
  it("parsea entero positivo", () => {
    expect(parseDecimal("12500000")).toBe(12500000);
  });

  it("parsea entero negativo (net negativo)", () => {
    expect(parseDecimal("-1700000")).toBe(-1700000);
  });

  it("parsea cero como string", () => {
    expect(parseDecimal("0")).toBe(0);
  });

  it("parsea decimales", () => {
    expect(parseDecimal("1234.56")).toBe(1234.56);
  });

  it("parsea con leading zeros (válido en el pattern del backend)", () => {
    expect(parseDecimal("00123")).toBe(123);
  });

  it("parsea con signo + explícito", () => {
    expect(parseDecimal("+99")).toBe(99);
  });

  it("null → 0", () => {
    expect(parseDecimal(null)).toBe(0);
  });

  it("undefined → 0", () => {
    expect(parseDecimal(undefined)).toBe(0);
  });

  it("string vacío → 0", () => {
    expect(parseDecimal("")).toBe(0);
  });

  it("string no numérico → 0 (fallback defensivo)", () => {
    expect(parseDecimal("abc")).toBe(0);
  });

  it("NaN literal → 0", () => {
    expect(parseDecimal("NaN")).toBe(0);
  });

  it("Infinity literal → 0 (Number.isFinite excluye)", () => {
    expect(parseDecimal("Infinity")).toBe(0);
  });
});

describe("formatPeriodLabel — period del backend a label es-CL", () => {
  it("YYYY-MM mensual → 'mes año'", () => {
    expect(formatPeriodLabel("2026-05")).toBe("may 2026");
  });

  it("enero → ene", () => {
    expect(formatPeriodLabel("2026-01")).toBe("ene 2026");
  });

  it("diciembre → dic", () => {
    expect(formatPeriodLabel("2026-12")).toBe("dic 2026");
  });

  it("YYYY-MM-DD diario → DD-MM-AAAA (mes-año, nunca año-mes)", () => {
    expect(formatPeriodLabel("2026-05-13")).toBe("13-05-2026");
  });

  it("YYYY-MM-DD semanal (lunes del bucket en granularity=week) → DD-MM-AAAA", () => {
    /* Backend con granularity=week emite el lunes del bucket en formato
       YYYY-MM-DD; lo mostramos como DD-MM-AAAA. */
    expect(formatPeriodLabel("2026-05-04")).toBe("04-05-2026");
  });

  it("mes fuera de rango (00, 13, 99) → fallback al string original (no híbrido)", () => {
    /* No válido en el backend; el fallback defensivo devuelve el string TAL CUAL
       (no "00 2026"/"13 2026" como hacía antes del fix del code-review #2). */
    expect(formatPeriodLabel("2026-00")).toBe("2026-00");
    expect(formatPeriodLabel("2026-13")).toBe("2026-13");
    expect(formatPeriodLabel("2026-99")).toBe("2026-99");
  });

  it("formato desconocido → fallback string original", () => {
    expect(formatPeriodLabel("totalmente-otro-formato")).toBe("totalmente-otro-formato");
  });
});

describe("formatBucketLabel — label del bucket según granularidad (fechas reales)", () => {
  it("semana desde el lunes YYYY-MM-DD → 'Sem. 11–17 may' (no 'W1' ni fecha suelta)", () => {
    expect(formatBucketLabel("2026-05-11", "week")).toBe("Sem. 11–17 may");
  });

  it("semana desde ISO YYYY-Www → mismo rango real de fechas", () => {
    // ISO semana 20 de 2026 = lunes 11-may .. domingo 17-may.
    expect(formatBucketLabel("2026-W20", "week")).toBe("Sem. 11–17 may");
  });

  it("semana que cruza de mes → 'Sem. 27 abr – 3 may'", () => {
    expect(formatBucketLabel("2026-04-27", "week")).toBe("Sem. 27 abr – 3 may");
  });

  it("mes → 'may 2026' (igual que formatPeriodLabel)", () => {
    expect(formatBucketLabel("2026-05", "month")).toBe("may 2026");
  });

  it("día → DD-MM-AAAA (convención de la app)", () => {
    expect(formatBucketLabel("2026-05-13", "day")).toBe("13-05-2026");
  });

  it("formato de semana inesperado → fallback defensivo (no rompe)", () => {
    expect(formatBucketLabel("basura", "week")).toBe("basura");
  });
});

describe("formatPeriodMMYYYY — YYYY-MM a MM-YYYY (mes-año)", () => {
  it("invierte a MM-YYYY", () => {
    expect(formatPeriodMMYYYY("2026-06")).toBe("06-2026");
    expect(formatPeriodMMYYYY("2026-01")).toBe("01-2026");
    expect(formatPeriodMMYYYY("2027-12")).toBe("12-2027");
  });

  it("formato no esperado → string original (fallback)", () => {
    expect(formatPeriodMMYYYY("2026-06-13")).toBe("2026-06-13");
    expect(formatPeriodMMYYYY("otro")).toBe("otro");
  });
});

describe("buildMonthOptions — opciones de mes para los selects de rango", () => {
  it("value en YYYY-MM y label en MM-YYYY; incluye el mes actual", () => {
    const opts = buildMonthOptions(new Date(2026, 5, 21), 2, 2); // jun 2026, ±2
    expect(opts).toEqual([
      { value: "2026-04", label: "04-2026" },
      { value: "2026-05", label: "05-2026" },
      { value: "2026-06", label: "06-2026" },
      { value: "2026-07", label: "07-2026" },
      { value: "2026-08", label: "08-2026" },
    ]);
  });

  it("cruza el cambio de año correctamente", () => {
    const opts = buildMonthOptions(new Date(2026, 11, 1), 1, 1); // dic 2026, ±1
    expect(opts.map((o) => o.value)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });

  it("string vacío → ''", () => {
    expect(formatPeriodLabel("")).toBe("");
  });
});

describe("isValidPeriod", () => {
  it("acepta YYYY-MM con mes 01-12", () => {
    expect(isValidPeriod("2026-01")).toBe(true);
    expect(isValidPeriod("2026-05")).toBe(true);
    expect(isValidPeriod("2026-12")).toBe(true);
  });

  it("rechaza mes 00", () => {
    expect(isValidPeriod("2026-00")).toBe(false);
  });

  it("rechaza mes 13", () => {
    expect(isValidPeriod("2026-13")).toBe(false);
  });

  it("rechaza año de 2 dígitos", () => {
    expect(isValidPeriod("26-05")).toBe(false);
  });

  it("rechaza separador distinto a '-'", () => {
    expect(isValidPeriod("2026/05")).toBe(false);
    expect(isValidPeriod("202605")).toBe(false);
  });

  it("rechaza string vacío", () => {
    expect(isValidPeriod("")).toBe(false);
  });

  it("rechaza formato YYYY-MM-DD (no es el shape del input)", () => {
    expect(isValidPeriod("2026-05-13")).toBe(false);
  });
});

describe("isValidPeriodRange", () => {
  it("acepta from < to", () => {
    expect(isValidPeriodRange("2026-05", "2026-08")).toBe(true);
  });

  it("acepta from === to (rango de 1 mes)", () => {
    expect(isValidPeriodRange("2026-05", "2026-05")).toBe(true);
  });

  it("rechaza from > to", () => {
    expect(isValidPeriodRange("2026-08", "2026-05")).toBe(false);
  });

  it("rechaza si from es inválido", () => {
    expect(isValidPeriodRange("2026-13", "2026-08")).toBe(false);
  });

  it("rechaza si to es inválido", () => {
    expect(isValidPeriodRange("2026-05", "")).toBe(false);
  });

  it("comparación lexicográfica cruza años correctamente", () => {
    expect(isValidPeriodRange("2025-11", "2026-02")).toBe(true);
    expect(isValidPeriodRange("2026-02", "2025-11")).toBe(false);
  });
});
