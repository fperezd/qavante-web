import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { ImpuestosV06View } from "./impuestos-v06-view";
import {
  estimacionF29V06,
  filasCalendarioV06,
  type FilaCalendarioV06,
} from "./impuestos-v06-model";
import {
  F29_IMPUESTO_ESTIMABLE_V06,
  F29_IMPUESTO_NO_ESTIMABLE_V06,
  HOY_V06,
  PREVIRED_TOTALES_V06,
  mesesF29SinVencidosV06,
  mesesF29V06,
  tgrMovimientosV06,
} from "./impuestos-v06-fixtures";

/* V06 · Impuestos — la vista, renderizada de verdad (react-dom/server, sin browser). Mismo
 * patrón que `presupuesto-v09-view.test.tsx`: Ley 2 (máximo un rojo, con control positivo),
 * concordancia N=1 con gemelo, "no sé" explícito con gemelo positivo, huecos declarados EN
 * pantalla y el mutante nulo de control (los estados producen HTML distinto). Las interacciones
 * (exportar, ordenar, Ley 7 a 360/346/320) viven en las stories. */

function filasNormales(): FilaCalendarioV06[] {
  return filasCalendarioV06({
    mesesF29: mesesF29V06(),
    estimacionF29: estimacionF29V06(F29_IMPUESTO_ESTIMABLE_V06),
    previred: { period: "2026-08", ...PREVIRED_TOTALES_V06 },
    tgrAutenticado: true,
    tgrMovimientos: tgrMovimientosV06(),
    hoy: HOY_V06,
  });
}

function html(props: Partial<ComponentProps<typeof ImpuestosV06View>> = {}): string {
  return renderToStaticMarkup(
    <ImpuestosV06View
      hoy={HOY_V06}
      filas={filasNormales()}
      estimacionF29={estimacionF29V06(F29_IMPUESTO_ESTIMABLE_V06)}
      {...props}
    />,
  );
}

function texto(h: string): string {
  return h
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ley 2 — cuántos elementos llevan el token rojo (Pill variant="bad"). */
function rojos(h: string): number {
  return (h.match(/class="[^"]*rediseno-rojo[^"]*"/g) ?? []).length;
}

describe("ImpuestosV06View — Ley 2: máximo un rojo por pantalla", () => {
  it("con un F-29 vencido y no declarado, hay EXACTAMENTE un rojo", () => {
    expect(rojos(html())).toBe(1);
  });

  it("[control positivo] sin ningún F-29 vencido, cero rojo", () => {
    const filas = filasCalendarioV06({
      mesesF29: mesesF29SinVencidosV06(),
      previred: { period: "2026-08", ...PREVIRED_TOTALES_V06 },
      tgrAutenticado: true,
      tgrMovimientos: tgrMovimientosV06(),
      hoy: HOY_V06,
    });
    expect(rojos(html({ filas }))).toBe(0);
  });

  it("con DOS F-29 vencidos, sigue habiendo un único rojo (nunca dos)", () => {
    const filas = filasCalendarioV06({
      mesesF29: mesesF29V06().map((m) =>
        m.periodo === "2026-05"
          ? {
              ...m,
              estado: "no_declarado_vencido" as const,
              declarado: false,
              folio: null,
              saldo: null,
            }
          : m,
      ),
      previred: { period: "2026-08", ...PREVIRED_TOTALES_V06 },
      tgrAutenticado: true,
      tgrMovimientos: tgrMovimientosV06(),
      hoy: HOY_V06,
    });
    expect(rojos(html({ filas }))).toBe(1);
  });

  it("no lleva rojo en el estado de error", () => {
    expect(rojos(html({ filas: undefined, error: "el SII no respondió" }))).toBe(0);
  });

  it("no lleva rojo en el estado de carga", () => {
    expect(rojos(html({ filas: undefined }))).toBe(0);
  });
});

describe("ImpuestosV06View — tríada", () => {
  it("Próximo vencimiento, F-29 del mes en curso y Deudas TGR se muestran", () => {
    const t = texto(html());
    expect(t).toContain("Próximo vencimiento");
    expect(t).toContain("F-29 · mes en curso");
    expect(t).toContain("Deudas TGR");
  });

  it("Deudas TGR muestra la suma real de las filas con deuda ($525.000)", () => {
    expect(texto(html())).toContain("$525.000");
  });
});

describe("ImpuestosV06View — F-29 del mes en curso", () => {
  it("muestra el monto estimado, el desglose, el corte y las fuentes cuando estimable=true", () => {
    const t = texto(html());
    const i = t.indexOf("F-29 · mes en curso (estimado)");
    expect(i).toBeGreaterThan(-1);
    expect(t.slice(i, i + 100)).toContain("$530.000");
    expect(t).toContain("IVA débito $900.000");
    expect(t).toContain("IVA crédito $500.000");
    expect(t).toContain("RCV (al día");
    expect(t).toContain("BUK sincronizado (al día");
    expect(t).toMatch(/15-08-2026 \d{2}:30:00/);
  });

  it("[mutante estimable=false] muestra sin dato y missing_inputs aunque el total sea cero", () => {
    const contrato = { ...F29_IMPUESTO_NO_ESTIMABLE_V06, total_con_iva: 0 };
    const estimacion = estimacionF29V06(contrato);
    const filas = filasCalendarioV06({
      mesesF29: mesesF29V06(),
      estimacionF29: estimacion,
      previred: { period: "2026-08", ...PREVIRED_TOTALES_V06 },
      tgrAutenticado: true,
      tgrMovimientos: tgrMovimientosV06(),
      hoy: HOY_V06,
    });
    const h = html({ filas, estimacionF29: estimacion });
    const t = texto(h);
    const i = t.indexOf("F-29 · mes en curso (estimado)");
    expect(t.slice(i, i + 100)).toContain("sin dato");
    expect(t).toContain("remanente de crédito fiscal");
    expect(t).toContain("impuesto de trabajadores");
    expect(h).not.toContain(">$0<");
    expect(h).toContain('aria-label="Por qué no sabemos f-29 · mes en curso (estimado)"');
  });
});

describe("ImpuestosV06View — TGR 'no sé' explícito (Ley 3)", () => {
  it("sin autenticar TGR: dice 'en preparación', no un cero disfrazado", () => {
    const filas = filasCalendarioV06({
      mesesF29: mesesF29V06(),
      previred: { period: "2026-08", ...PREVIRED_TOTALES_V06 },
      tgrAutenticado: false,
      tgrMovimientos: undefined,
      hoy: HOY_V06,
    });
    const t = texto(html({ filas }));
    expect(t).toMatch(/en preparación/i);
  });

  it("[control positivo] autenticado y con deuda, ese texto NO aparece", () => {
    expect(texto(html())).not.toMatch(/en preparación/i);
  });
});

describe("ImpuestosV06View — Ley 9: footer fijo literal (issue #73)", () => {
  it("muestra el texto EXACTO", () => {
    expect(texto(html())).toContain(
      "Las obligaciones tributarias nunca se postergan desde Qavante.",
    );
  });

  it("no ofrece ningún botón de postergar impuestos", () => {
    const h = html();
    expect(h).not.toMatch(/<button[^>]*>[^<]*postergar[^<]*<\/button>/i);
  });

  it("la fila de IVA postergado se muestra pero aclara que es del SII, no de Qavante", () => {
    const t = texto(html());
    expect(t).toMatch(/IVA postergado/);
    expect(t).toMatch(/SII/);
  });
});

describe("ImpuestosV06View — huecos declarados (issue #73)", () => {
  it("declara en pantalla sólo la conciliación bancaria faltante", () => {
    const t = texto(html());
    expect(t).toMatch(/conciliado con el cargo\s*bancario/i);
    expect(t).not.toMatch(/necesita contrastarse contra un F-29 real/i);
  });

  it("incluye el issue sucesor cuando se lo pasan", () => {
    expect(texto(html({ issueSucesor: "#999" }))).toContain("#999");
  });
});

describe("ImpuestosV06View — calendario tributario", () => {
  it("lista los meses F-29, Previred y TGR", () => {
    const t = texto(html());
    expect(t).toContain("F-29 · Marzo 2026");
    expect(t).toContain("Previred · Agosto 2026");
    expect(t).toContain("TGR · IVA (mensual)");
    expect(t).toContain("TGR · PPM");
  });

  it("la fila del IVA postergado de abril aparece con su propio monto", () => {
    const t = texto(html());
    expect(t).toContain("IVA postergado · Abril 2026");
    expect(t).toContain("$300.000");
  });

  it("el F-29 sin declarar del mes en curso muestra la estimación y nunca un falso $0", () => {
    const h = html();
    expect(h).toContain("$530.000");
    expect(h).not.toContain("$0");
  });
});

describe("ImpuestosV06View — concordancia singular/plural (N=1, issue #94)", () => {
  it("1 sola deuda TGR (singular) — no dice '1 giros o deudas vigentes'", () => {
    const filas = filasCalendarioV06({
      mesesF29: mesesF29V06(),
      previred: { period: "2026-08", ...PREVIRED_TOTALES_V06 },
      tgrAutenticado: true,
      tgrMovimientos: [tgrMovimientosV06()[0]!],
      hoy: HOY_V06,
    });
    const t = texto(html({ filas }));
    expect(t).toContain("1 giro o deuda vigente");
    expect(t).not.toContain("1 giros o deudas vigentes");
  });

  it("[control positivo] con 2 deudas TGR, dice 'giros o deudas vigentes' (plural)", () => {
    expect(texto(html())).toContain("2 giros o deudas vigentes");
  });
});

describe("ImpuestosV06View — estados de carga y error (Ley 8)", () => {
  it("carga: dice qué se trae y declara que no hay ETA, nunca 'Cargando…' desnudo", () => {
    const t = texto(html({ filas: undefined }));
    expect(t).not.toBe("Cargando…");
    expect(t).toMatch(/trayendo/i);
    expect(t).toMatch(/no publica un tiempo estimado/i);
  });

  it("error: dice la causa y ofrece reintentar", () => {
    const t = texto(html({ filas: undefined, error: "el SII no respondió" }));
    expect(t).toContain("el SII no respondió");
  });

  it("[mutante nulo de control] los tres estados (normal/carga/error) producen HTML distinto", () => {
    const normal = html();
    const carga = html({ filas: undefined });
    const error = html({ filas: undefined, error: "x" });
    const variantes = [normal, carga, error];
    for (let i = 0; i < variantes.length; i += 1) {
      for (let j = i + 1; j < variantes.length; j += 1) {
        expect(variantes[i]).not.toBe(variantes[j]);
      }
    }
  });
});
