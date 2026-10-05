import { describe, it, expect } from "vitest";
import {
  FORBIDDEN_COPY_WORDS,
  readinessAmount,
  readinessDays,
  readinessHeadline,
  readinessStep,
} from "./readiness-copy";
import type { FinancialReadiness, ReadinessLevel } from "@/lib/api/onboarding-readiness";

/* Lo que se prueba acá no son las funciones, son las dos reglas de producto que la
   pantalla final del wizard existe para cumplir, cada una como invariante sobre LOS
   CINCO niveles y no como un caso de ejemplo. */

const NIVELES: ReadinessLevel[] = ["arranque", "piso", "horizonte", "palancas", "nomina_protegida"];

function fin(over: Partial<FinancialReadiness> = {}): FinancialReadiness {
  return {
    level: "palancas",
    level_index: 3,
    levels_total: 5,
    unlocked_decision: "Qué cobros adelantar y qué pagos mover para no tocar el piso.",
    statement: "Mantén 6000000 CLP en caja: cubre 30 días de tus gastos esenciales.",
    covers: "cubre 45 días de tus gastos esenciales",
    currency: "CLP",
    minimum_cash: "6000000",
    cash_today: "9000000",
    essential_outflow_days_covered: 45,
    basis: {
      rung: "egresos_conciliados",
      label: "egresos operacionales conciliados del banco",
      buffer_days: 30,
      months_observed: 6,
      conservative: false,
      daily_essential_outflow: "200000",
    },
    next_action: {
      code: "configurar_remuneraciones",
      label: "Elegir tu sistema de remuneraciones",
      reason: "Las remuneraciones no se postergan: Qavante las separa de lo que sí puedes mover.",
    },
    missing: ["remuneraciones_configuradas"],
    satisfied: [],
    ...over,
  };
}

describe("readiness-copy — siempre un número, y siempre qué cubre", () => {
  it("el titular trae el monto formateado y qué cubre", () => {
    const h = readinessHeadline(fin());
    expect(h.title).toBe("Mantén $6.000.000 en caja");
    expect(h.covers).toBe("cubre 30 días de tus gastos esenciales");
    expect(h.coverage).toBe("Tu caja de hoy cubre 45 días de tus gastos esenciales");
  });

  it("con piso en cero sigue habiendo cifra: cero es un número, no un vacío", () => {
    /* La rama que más importa. Un tenant recién registrado llega acá y la pantalla
       tiene que mostrar un número con su acción, nunca una pantalla sin cifra. */
    const h = readinessHeadline(
      fin({
        level: "arranque",
        minimum_cash: "0",
        essential_outflow_days_covered: 0,
        currency: null,
      }),
    );
    expect(h.title).toContain("0");
    expect(h.covers).toContain("gastos esenciales");
    expect(h.coverage).toBe("Tu caja de hoy cubre 0 días de tus gastos esenciales");
  });

  it("sin moneda declarada el monto va sin símbolo: no se inventa la moneda", () => {
    expect(readinessAmount("1500000", null)).toBe("1.500.000");
    expect(readinessAmount("1500000", "CLP")).toBe("$1.500.000");
  });

  it("los días llevan singular correcto y el cero es un día válido de mostrar", () => {
    expect(readinessDays(1)).toBe("1 día");
    expect(readinessDays(0)).toBe("0 días");
    expect(readinessDays(45)).toBe("45 días");
  });

  it("todo nivel produce un titular con al menos un dígito y un «qué cubre»", () => {
    for (const level of NIVELES) {
      const h = readinessHeadline(fin({ level }));
      expect(/\d/.test(h.title), `${level}: ${h.title}`).toBe(true);
      expect(h.covers).toContain("gastos esenciales");
      expect(/\d/.test(h.coverage)).toBe(true);
    }
  });
});

describe("readiness-copy — ninguna palabra que genere desconfianza", () => {
  it("nada de lo que se imprime usa las palabras prohibidas, en ningún nivel", () => {
    const textos: string[] = [];
    for (const level of NIVELES) {
      const f = fin({ level });
      const h = readinessHeadline(f);
      const s = readinessStep(f);
      textos.push(h.title, h.covers, h.coverage, s.label, s.reason);
    }
    expect(textos.length).toBeGreaterThan(0);
    for (const texto of textos) {
      for (const palabra of FORBIDDEN_COPY_WORDS) {
        expect(texto.toLowerCase(), `«${palabra}» en «${texto}»`).not.toContain(palabra);
      }
    }
  });

  it("la lista espeja la de la API: si una se mueve, la otra tiene que moverse", () => {
    /* Las dos listas viven en repos distintos y no hay un tipo que las una, así que la
       única defensa es que ambos lados tengan un test con el mismo contenido. */
    expect([...FORBIDDEN_COPY_WORDS]).toEqual([
      "preliminar",
      "estimado",
      "estimada",
      "confianza baja",
      "confianza media",
      "confianza alta",
      "no disponible",
      "no hay datos",
      "sin datos",
      "aproximado",
    ]);
  });
});

describe("readiness-copy — una sola acción, y la última es decidir", () => {
  it("cada nivel resuelve una ruta y ninguna queda indefinida", () => {
    for (const level of NIVELES) {
      const s = readinessStep(fin({ level }));
      expect(s.route, level).toMatch(/^\//);
      expect(s.label.length).toBeGreaterThan(0);
    }
  });

  it("el último nivel marca la acción como decisión y lleva a Caja", () => {
    const s = readinessStep(
      fin({
        level: "nomina_protegida",
        next_action: {
          code: "ver_plan_de_caja",
          label: "Ver tu plan de caja",
          reason: "Tienes lo necesario para decidir qué pagar y qué cobrar esta semana.",
        },
      }),
    );
    expect(s.isDecision).toBe(true);
    expect(s.route).toBe("/caja");
  });

  it("los niveles intermedios no se marcan como decisión", () => {
    for (const level of NIVELES.slice(0, 4)) {
      expect(readinessStep(fin({ level })).isDecision, level).toBe(false);
    }
  });
});
