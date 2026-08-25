import { describe, it, expect } from "vitest";
import {
  parseAmount,
  parseAmountOrNull,
  agingBreakdown,
  sortByUrgency,
  shareOfTotal,
  explicarVencidoSinDato,
  rutKey,
  vencidoDeDeudor,
  estadoVencidoDeudores,
  totalVencidoDeudores,
} from "./cobranza-format";
import type { ReceivableAging } from "@/lib/api/cobranza";

describe("parseAmount", () => {
  it("string-decimal → number; vacío/inválido → 0", () => {
    expect(parseAmount("24800000")).toBe(24800000);
    expect(parseAmount(undefined)).toBe(0);
    expect(parseAmount("x")).toBe(0);
  });

  /* GUARDA DE COMPILACIÓN (hallazgo H6). `parseAmount` NO debe aceptar `null`: es
     justamente lo que hacía que un campo del contrato volviéndose nullable entrara
     mudo y se mostrara como 0. Si alguien devuelve `string | null` a la firma, el
     `@ts-expect-error` queda sin usar y `npm run typecheck` se cae. Es un test que
     corre en el gate de tipos, no en vitest. */
  it("no acepta null por tipo (el 'no se sabe' no puede aplastarse a 0)", () => {
    const desconocido: string | null = null;
    // @ts-expect-error `null` debe ser un error de tipo acá: usar `parseAmountOrNull`.
    expect(parseAmount(desconocido)).toBe(0);
  });
});

describe("parseAmountOrNull (los tres estados de H6)", () => {
  it("(a) número real → number", () => {
    expect(parseAmountOrNull("24800000")).toBe(24800000);
  });

  it("(b) CERO VERIFICADO se conserva como 0, no se degrada a 'sin dato'", () => {
    // "estás al día" es el mensaje más valioso de la pantalla: no se puede perder.
    expect(parseAmountOrNull("0")).toBe(0);
    expect(parseAmountOrNull("0.00")).toBe(0);
  });

  it("(c) null/undefined/vacío/no numérico → null, NUNCA 0", () => {
    expect(parseAmountOrNull(null)).toBeNull();
    expect(parseAmountOrNull(undefined)).toBeNull();
    expect(parseAmountOrNull("")).toBeNull();
    expect(parseAmountOrNull("x")).toBeNull();
  });
});

describe("agingBreakdown", () => {
  const aging: ReceivableAging = {
    current: "16900000",
    d1_30: "3200000",
    d31_60: "2100000",
    d61_90: "1400000",
    d90_plus: "1200000",
  };

  it("devuelve los 5 tramos en orden con label", () => {
    const { bars } = agingBreakdown(aging);
    expect(bars.map((b) => b.key)).toEqual(["current", "d1_30", "d31_60", "d61_90", "d90_plus"]);
    expect(bars[0]?.label).toBe("Vigente");
    expect(bars[4]?.label).toBe("90+ días");
  });

  it("calcula % del total cuando el dato está COMPLETO", () => {
    const { bars, incomplete } = agingBreakdown(aging);
    const total = 16900000 + 3200000 + 2100000 + 1400000 + 1200000; // 24.8M
    expect(incomplete).toBe(false);
    expect(bars[0]?.pct).toBeCloseTo((16900000 / total) * 100, 5);
    expect(bars.reduce((a, b) => a + (b.pct ?? 0), 0)).toBeCloseTo(100, 5);
  });

  it("total 0 → pct 0 (sin división por cero)", () => {
    const empty: ReceivableAging = {
      current: "0",
      d1_30: "0",
      d31_60: "0",
      d61_90: "0",
      d90_plus: "0",
    };
    const { bars, incomplete } = agingBreakdown(empty);
    // Cero VERIFICADO en todos los tramos: NO es "incompleto".
    expect(incomplete).toBe(false);
    expect(bars.every((b) => b.pct === 0)).toBe(true);
    expect(bars.every((b) => b.amount === 0)).toBe(true);
  });

  /* EL BUG DE H6. Con los cuatro buckets de mora en `null`, `parseAmount` los
     aplastaba a 0 y la barra quedaba 100% "Vigente": la pantalla afirmaba "todo al
     día" justo cuando no sabía nada. */
  it("buckets de mora en null NO pintan 100% 'Vigente'", () => {
    const sinMora: ReceivableAging = {
      current: "16900000",
      d1_30: null,
      d31_60: null,
      d61_90: null,
      d90_plus: null,
    };
    const { bars, incomplete } = agingBreakdown(sinMora);
    expect(incomplete).toBe(true);
    // El vigente NO puede reclamar un porcentaje: el denominador es desconocido.
    expect(bars[0]?.pct).toBeNull();
    expect(bars.every((b) => b.pct === null)).toBe(true);
  });

  it("un bucket null se reporta como null, no como 0", () => {
    const { bars, incomplete, knownTotal } = agingBreakdown({ ...aging, d90_plus: null });
    expect(incomplete).toBe(true);
    expect(bars[4]?.amount).toBeNull();
    // Lo que SÍ se sabe no se pierde: el vigente conserva su monto real.
    expect(bars[0]?.amount).toBe(16900000);
    expect(knownTotal).toBe(16900000 + 3200000 + 2100000 + 1400000);
  });
});

describe("explicarVencidoSinDato", () => {
  it("explica el null con el monto SIN fecha de vencimiento", () => {
    const r = explicarVencidoSinDato({ undated_amount: "8400000" });
    expect(r.undated).toBe(8400000);
    expect(r.motivo).toContain("No podemos calcular cuánto está vencido");
    expect(r.motivo).toContain("8.400.000");
    expect(r.motivo).toContain("no tiene fecha de vencimiento");
    // Y QUÉ hacer: una explicación sin salida deja al dueño igual de a ciegas.
    expect(r.accion).not.toBe("");
  });

  it("suma las missing_sources que reporta el backend", () => {
    const r = explicarVencidoSinDato({
      undated_amount: "8400000",
      missing_sources: ["Sincronización SII pendiente", "Términos de pago sin definir"],
    });
    expect(r.motivo).toContain("Sincronización SII pendiente");
    expect(r.motivo).toContain("Términos de pago sin definir");
  });

  it("sin undated_amount igual explica (no inventa un monto)", () => {
    const r = explicarVencidoSinDato({ undated_amount: null });
    expect(r.undated).toBeNull();
    expect(r.motivo).toContain("No podemos calcular cuánto está vencido");
    expect(r.motivo).not.toContain("$");
  });
});

describe("rutKey", () => {
  it("normaliza y tolera el rut ausente del contrato (null si falta)", () => {
    expect(rutKey("76.123.456-7")).toBe("76123456-7");
    expect(rutKey(null)).toBe("");
    expect(rutKey(undefined)).toBe("");
  });
});

describe("sortByUrgency", () => {
  const d = (name: string, overdue: string, total: string) => ({ name, overdue, total });

  it("prioriza el más vencido (a igual vencido, mayor total)", () => {
    const out = sortByUrgency([
      d("A", "0", "9000000"),
      d("B", "3000000", "5000000"),
      d("C", "3000000", "8000000"),
    ]);
    expect(out.map((x) => x.name)).toEqual(["C", "B", "A"]);
  });

  it("no muta el array de entrada", () => {
    const input = [d("A", "0", "1"), d("B", "5", "1")];
    const copy = [...input];
    sortByUrgency(input);
    expect(input).toEqual(copy);
  });
});

describe("shareOfTotal (concentración)", () => {
  it("participación % del monto sobre el total", () => {
    expect(shareOfTotal("50", "200")).toBe(25);
    expect(shareOfTotal("83430109", "205417901")).toBeCloseTo(40.6, 1);
  });
  it("total 0 o inválido → 0 (sin división por cero)", () => {
    expect(shareOfTotal("100", "0")).toBe(0);
    expect(shareOfTotal("100", "")).toBe(0);
  });
});

/* El vencido POR DEUDOR tiene TRES estados. El contrato (#124) lo dice literal:
   "La tabla no debe renderizarlo como $0". Estos tests existen porque el código
   colapsaba los tres a dos con un `parseAmount(d.overdue) > 0`, y en producción
   —donde HOY el 100% de los deudores viene con `overdue: null`— eso significaba
   pintar una lista limpia, indistinguible de "todos al día". */
describe("vencido por deudor — los tres estados", () => {
  const d = (overdue: string | null, total = "100") => ({ overdue, total });

  it("distingue no-se-sabe de cero verificado", () => {
    expect(vencidoDeDeudor(d(null))).toBeNull();
    expect(vencidoDeDeudor(d("0"))).toBe(0);
    expect(vencidoDeDeudor(d("5000"))).toBe(5000);
  });

  it("el estado del conjunto no colapsa a booleano", () => {
    expect(estadoVencidoDeudores([d("0"), d("0")])).toBe("al-dia");
    expect(estadoVencidoDeudores([d(null), d("0")])).toBe("no-se-sabe");
    expect(estadoVencidoDeudores([d(null), d("500")])).toBe("con-mora");
    expect(estadoVencidoDeudores([])).toBe("al-dia");
  });

  it("la suma es null si UN sumando no se sabe — nunca sub-reporta la mora", () => {
    expect(totalVencidoDeudores([d("100"), d("250")])).toBe(350);
    expect(totalVencidoDeudores([d("100"), d(null)])).toBeNull();
    expect(totalVencidoDeudores([])).toBe(0);
  });

  it("orden por urgencia: el desconocido va sobre el cero verificado", () => {
    const conMora = { name: "mora", overdue: "900", total: "1000" };
    const noSe = { name: "no-se", overdue: null, total: "10" };
    const alDia = { name: "al-dia", overdue: "0", total: "9999" };
    expect(sortByUrgency([alDia, noSe, conMora]).map((x) => x.name)).toEqual([
      "mora",
      "no-se",
      "al-dia",
    ]);
  });

  it("dentro del grupo desconocido, desempata el total mayor", () => {
    const chico = { name: "chico", overdue: null, total: "10" };
    const grande = { name: "grande", overdue: null, total: "900" };
    expect(sortByUrgency([chico, grande]).map((x) => x.name)).toEqual(["grande", "chico"]);
  });
});
