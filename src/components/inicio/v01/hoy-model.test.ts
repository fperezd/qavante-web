import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DashboardSummaryV2 } from "@/lib/api/dashboard";
import { formatClp } from "@/lib/formatters/clp";
import { saldoCajaHoy } from "@/lib/finanzas/caja-hoy";
import {
  cajaBajoCero14d,
  contextoHoy,
  crumbHoy,
  decisionesHoy,
  indicadoresHoy,
  pendientesLabel,
  sueldosEnRiesgo,
  veredictoHoy,
} from "./hoy-model";
import { cajaHoy } from "@/lib/finanzas/caja-hoy";

/* V01 · Hoy — el veredicto de la portada, fijado.
 *
 * Los cuatro estados del titular, la Ley 1 (un concepto, un número), la Ley 10 (día perfecto /
 * crisis con menos interfaz) y los buckets explícitos de "no sé". */

const HOY = new Date("2026-08-30T12:00:00Z");

function summary(over: Partial<DashboardSummaryV2> = {}): DashboardSummaryV2 {
  return {
    executive_phrase: null,
    pulso: null,
    cash_today: {
      total: "9800000",
      last_updated: "2026-08-30T08:00:00Z",
      data_state: "available",
    },
    cash_forecast: {
      min_14d: "4200000",
      min_30d: "3100000",
      days_of_cash: 96,
      days_of_cash_vencido_exigible_excluido: "0",
      last_updated: "2026-08-30T08:00:00Z",
      source: "banco",
    },
    cash_gap: {
      critical_obligations_14d: "0",
      projected_cash_14d: "4200000",
      cash_gap_amount_14d: "0",
      has_gap: false,
      vencido_exigible: "0",
      vencido_exigible_n: 0,
      vencido_exigible_desde_dias: 90,
      vencido_exigible_mora_estructural: "0",
      last_updated: "2026-08-30T08:00:00Z",
      source: "banco",
    },
    overdue_collections: null,
    critical_payments: null,
    operational_result: null,
    priority_actions: [],
    ...over,
  } as DashboardSummaryV2;
}

const SUELDOS_EN_5_DIAS = {
  due_7d: "7400000",
  due_14d: "7400000",
  next_critical: {
    label: "Proveedor próximo",
    due_date: "2026-09-04",
    amount: "7400000",
    category: "supplier",
    is_overdue: false,
  },
  next_payroll: {
    label: "Remuneraciones de agosto",
    due_date: "2026-09-04",
    amount: "7400000",
    category: "payroll",
    is_overdue: false,
  },
  last_updated: "2026-08-30T08:00:00Z",
  source: "buk",
};

const CAJA_BAJO_CERO = {
  cash_forecast: {
    min_14d: "-1121250",
    min_30d: "-3400000",
    days_of_cash: 0,
    days_of_cash_vencido_exigible_excluido: "0",
    last_updated: "2026-08-30T08:00:00Z",
    source: "banco",
  },
  cash_gap: {
    critical_obligations_14d: "7400000",
    projected_cash_14d: "-1121250",
    cash_gap_amount_14d: "1121250",
    has_gap: true,
    vencido_exigible: "0",
    vencido_exigible_n: 0,
    vencido_exigible_desde_dias: 90,
    vencido_exigible_mora_estructural: "0",
    last_updated: "2026-08-30T08:00:00Z",
    source: "banco",
  },
};

const ACCION = (priority: number, reason: string) => ({
  priority,
  reason,
  deadline: "5 días",
  cta_label: "Ir a cobrar",
  cta_href: "/cobrar",
  amount: "2500000",
  impact_label: "de impacto en caja",
});

/* ── Los cuatro estados del titular ──────────────────────────────────────────── */

describe("titular-veredicto (spec §V01, aceptación)", () => {
  it("SANA: la caja no cruza el cero a 14 días", () => {
    const v = veredictoHoy(summary({ priority_actions: [ACCION(1, "Cobrar a Kaufmann")] }), HOY);
    expect(v.estado).toBe("sana");
    expect(v.titular).toBe("Tu empresa está sana");
    // Contrapeso del negativo de más abajo, con la MISMA cadena.
    expect(v.titular).not.toBe("Tu caja necesita atención");
  });

  it("ATENCIÓN: caja < 0 a 14 días (la regla literal de la spec)", () => {
    const v = veredictoHoy(summary(CAJA_BAJO_CERO), HOY);
    expect(v.estado).toBe("atencion");
    expect(v.titular).toBe("Tu caja necesita atención");
    // Y NO escala a crisis: sin `next_payroll` estructural, no hay evidencia de sueldos.
    expect(v.estado).not.toBe("crisis");
    expect(v.soloDecisionCritica).toBe(false);
  });

  it("CRISIS: sueldos en riesgo (caja bajo cero + sueldos venciendo en la ventana)", () => {
    const v = veredictoHoy(
      summary({ ...CAJA_BAJO_CERO, critical_payments: SUELDOS_EN_5_DIAS }),
      HOY,
    );
    expect(v.estado).toBe("crisis");
    expect(v.titular).toBe("Tu caja no alcanza para cubrir la nómina");
    // Ley 10: en crisis se muestra SÓLO la decisión crítica.
    expect(v.soloDecisionCritica).toBe(true);
  });

  it('SIN DATO: sin caja ni brecha NO se dice "sana" — es el bucket explícito del "no sé"', () => {
    const v = veredictoHoy(summary({ cash_today: null, cash_forecast: null, cash_gap: null }), HOY);
    expect(v.estado).toBe("sin_dato");
    expect(v.titular).toBe("Todavía no podemos darte un veredicto");
    /* El defecto de `qavante-api#162` con otro sustantivo: decir la palabra tranquilizadora sobre
       un tenant del que no se sabe nada. Cada negativo va con su gemelo positivo arriba. */
    expect(v.titular).not.toBe("Tu empresa está sana");
    expect(v.estado).not.toBe("sana");
  });

  it("SIN DATO tampoco se pinta de crisis: inventar una mala noticia es el error simétrico", () => {
    const v = veredictoHoy(summary({ cash_today: null, cash_forecast: null, cash_gap: null }), HOY);
    expect(v.estado).not.toBe("crisis");
    expect(v.soloDecisionCritica).toBe(false);
  });

  it("un summary nulo (la red falló) cae en sin_dato, no en una afirmación", () => {
    expect(veredictoHoy(null, HOY).estado).toBe("sin_dato");
    expect(veredictoHoy(undefined, HOY).estado).toBe("sin_dato");
  });
});

/* ── Ley 10 · día perfecto ───────────────────────────────────────────────────── */

describe("Ley 10 · día perfecto", () => {
  it('empresa sana y nada pendiente → "No hay nada que necesite tu OK" y termina', () => {
    const v = veredictoHoy(summary({ priority_actions: [] }), HOY);
    expect(v.diaPerfecto).toBe(true);
    expect(v.titular).toBe("No hay nada que necesite tu OK");
    expect(v.pendientes).toBe(0);
    expect(decisionesHoy(summary({ priority_actions: [] }))).toHaveLength(0);
  });

  it("con una acción pendiente YA no es día perfecto (contrapeso del caso de arriba)", () => {
    const v = veredictoHoy(summary({ priority_actions: [ACCION(1, "Cobrar a Kaufmann")] }), HOY);
    expect(v.diaPerfecto).toBe(false);
    expect(v.titular).toBe("Tu empresa está sana");
    expect(v.titular).not.toBe("No hay nada que necesite tu OK");
  });

  it("conserva una decisión financiera que el servidor publica con ruta de conciliación", () => {
    const decision = {
      ...ACCION(1, "Revisa el pago que evita que tu caja quede bajo cero"),
      cta_label: "Ver propuesta",
      cta_href: "/caja/conciliacion?decision_id=evitar-caja-negativa",
    };
    const s = summary({ priority_actions: [decision] });

    expect(veredictoHoy(s, HOY).pendientes).toBe(1);
    expect(veredictoHoy(s, HOY).diaPerfecto).toBe(false);
    expect(decisionesHoy(s)).toEqual([decision]);
    expect(decisionesHoy(s)[0]).toMatchObject({
      reason: "Revisa el pago que evita que tu caja quede bajo cero",
      cta_label: "Ver propuesta",
      cta_href: "/caja/conciliacion?decision_id=evitar-caja-negativa",
    });
  });

  it("caja sin dato y nada pendiente NO es día perfecto: no se sabe si lo es", () => {
    const v = veredictoHoy(
      summary({ cash_today: null, cash_forecast: null, cash_gap: null, priority_actions: [] }),
      HOY,
    );
    expect(v.diaPerfecto).toBe(false);
    // El label sí dice que no hay nada que aprobar — eso SÍ se sabe.
    expect(v.pendientesLabel).toBe("No hay nada que necesite tu OK");
  });

  it("una decisión persistida vigente impide declarar día perfecto", () => {
    const v = veredictoHoy(summary({ priority_actions: [] }), HOY, 1);
    expect(v.diaPerfecto).toBe(false);
    expect(v.titular).toBe("Tu empresa está sana");
    expect(v.pendientesLabel).toBe("hay 1 cosa que necesita tu OK");
  });
});

describe('"hay N cosas que necesitan tu OK"', () => {
  it("singular, plural y cero", () => {
    expect(pendientesLabel(0)).toBe("No hay nada que necesite tu OK");
    expect(pendientesLabel(1)).toBe("hay 1 cosa que necesita tu OK");
    expect(pendientesLabel(3)).toBe("hay 3 cosas que necesitan tu OK");
    // "1 cosas" delata que nadie leyó la pantalla.
    expect(pendientesLabel(1)).not.toContain("cosas");
  });

  it("N y las cards respetan todas las acciones publicadas", () => {
    const s = summary({
      priority_actions: [1, 2, 3, 4, 5].map((n) => ACCION(n, `Acción ${n}`)),
    });
    expect(veredictoHoy(s, HOY).pendientes).toBe(5);
    expect(veredictoHoy(s, HOY).pendientesLabel).toBe("hay 5 cosas que necesitan tu OK");
    expect(decisionesHoy(s)).toHaveLength(5);
  });
});

/* ── Sección 4 · cards de decisión ───────────────────────────────────────────── */

describe("Esperando tu visto bueno (acciones prioritarias server-owned)", () => {
  it("conserva el orden publicado y no corta la lista", () => {
    const s = summary({
      priority_actions: [
        ACCION(3, "Tercera"),
        ACCION(1, "Primera"),
        ACCION(2, "Segunda"),
        ACCION(4, "Cuarta"),
      ],
    });
    expect(decisionesHoy(s).map((a) => a.reason)).toEqual([
      "Tercera",
      "Primera",
      "Segunda",
      "Cuarta",
    ]);
  });

  it("en crisis conserva todas las decisiones publicadas", () => {
    const s = summary({
      ...CAJA_BAJO_CERO,
      critical_payments: SUELDOS_EN_5_DIAS,
      priority_actions: [ACCION(1, "Primera"), ACCION(2, "Segunda"), ACCION(3, "Tercera")],
    });
    const v = veredictoHoy(s, HOY);
    expect(v.pendientes).toBe(3);
    expect(v.pendientesLabel).toBe("hay 3 cosas que necesitan tu OK");
    expect(decisionesHoy(s)).toEqual(s.priority_actions);
  });

  it("devuelve el array del backend sin transformarlo", () => {
    const acciones = [ACCION(3, "Tercera"), ACCION(1, "Primera")];
    const s = summary({ priority_actions: acciones });
    expect(decisionesHoy(s)).toBe(acciones);
    expect(acciones.map((a) => a.reason)).toEqual(["Tercera", "Primera"]);
  });
});

/* ── Las reglas, por separado ────────────────────────────────────────────────── */

describe("cajaBajoCero14d", () => {
  it("mira la mínima a 14 días", () => {
    expect(cajaBajoCero14d(summary())).toBe(false);
    expect(cajaBajoCero14d(summary(CAJA_BAJO_CERO))).toBe(true);
  });

  it("un has_gap del backend MANDA aunque nuestra resta no vea la brecha", () => {
    /* El backend ve el valle intra-período y el colchón de caja mínima; nosotros sólo el saldo al
       día 14. El front nunca puede degradar una brecha declarada a "holgado". */
    const s = summary({
      cash_gap: { ...summary().cash_gap!, has_gap: true },
    });
    expect(cajaBajoCero14d(s)).toBe(true);
    // Contrapeso: con el MISMO min_14d y `has_gap: false`, es false.
    expect(cajaBajoCero14d(summary())).toBe(false);
  });

  it("sin forecast ni gap devuelve null, y null NO es false", () => {
    const s = summary({ cash_forecast: null, cash_gap: null });
    expect(cajaBajoCero14d(s)).toBeNull();
    expect(cajaBajoCero14d(s)).not.toBe(false);
  });
});

describe("sueldosEnRiesgo — Ley 3: sin evidencia dura de los DOS lados, no hay crisis", () => {
  const conSueldos = summary({ ...CAJA_BAJO_CERO, critical_payments: SUELDOS_EN_5_DIAS });

  it("sí: sueldos venciendo en la ventana + caja bajo cero", () => {
    expect(sueldosEnRiesgo(conSueldos, HOY)).toBe(true);
  });

  it("sí: next_payroll sigue siendo evidencia estructural si su fuente aún no llena category", () => {
    const s = summary({
      ...CAJA_BAJO_CERO,
      critical_payments: {
        ...SUELDOS_EN_5_DIAS,
        next_payroll: { ...SUELDOS_EN_5_DIAS.next_payroll, category: null },
      },
    });
    expect(sueldosEnRiesgo(s, HOY)).toBe(true);
  });

  it("no: la caja alcanza (mismo vencimiento de sueldos)", () => {
    expect(sueldosEnRiesgo(summary({ critical_payments: SUELDOS_EN_5_DIAS }), HOY)).toBe(false);
  });

  it("no: caja bajo cero pero no hay nómina estructural", () => {
    const s = summary({
      ...CAJA_BAJO_CERO,
      critical_payments: {
        ...SUELDOS_EN_5_DIAS,
        next_critical: {
          label: "F29 de agosto",
          due_date: "2026-09-04",
          amount: "3100000",
          is_overdue: false,
        },
        next_payroll: null,
      },
    });
    expect(sueldosEnRiesgo(s, HOY)).toBe(false);
    expect(veredictoHoy(s, HOY).estado).toBe("atencion");
  });

  it('no: "imposiciones" no son sueldos — aunque el texto lo diga, la categoría evita inferirlo', () => {
    const s = summary({
      ...CAJA_BAJO_CERO,
      critical_payments: {
        ...SUELDOS_EN_5_DIAS,
        next_critical: {
          label: "Imposiciones (Previred)",
          due_date: "2026-09-04",
          amount: "900000",
          is_overdue: false,
        },
        next_payroll: {
          label: "Imposiciones (Previred)",
          due_date: "2026-09-04",
          amount: "900000",
          category: "tax",
          is_overdue: false,
        },
      },
    });
    expect(sueldosEnRiesgo(s, HOY)).toBe(false);
  });

  it("no: los sueldos vencen FUERA de la ventana de 14 días", () => {
    const s = summary({
      ...CAJA_BAJO_CERO,
      critical_payments: {
        ...SUELDOS_EN_5_DIAS,
        next_payroll: { ...SUELDOS_EN_5_DIAS.next_payroll, due_date: "2026-09-30" },
      },
    });
    expect(sueldosEnRiesgo(s, HOY)).toBe(false);
    // Gemelo positivo: con la fecha DENTRO de la ventana, el mismo objeto sí dispara.
    expect(sueldosEnRiesgo(conSueldos, HOY)).toBe(true);
  });

  it("sí: unos sueldos YA VENCIDOS también cuentan (no se cae por el borde)", () => {
    const s = summary({
      ...CAJA_BAJO_CERO,
      critical_payments: {
        ...SUELDOS_EN_5_DIAS,
        next_payroll: {
          ...SUELDOS_EN_5_DIAS.next_payroll,
          due_date: "2026-08-25",
          is_overdue: true,
        },
      },
    });
    expect(sueldosEnRiesgo(s, HOY)).toBe(true);
  });

  it("no infiere nómina desde un label aunque parezca sueldo; usa sólo categoría estructural", () => {
    const s = summary({
      ...CAJA_BAJO_CERO,
      critical_payments: {
        ...SUELDOS_EN_5_DIAS,
        next_payroll: {
          label: "Planilla BUK",
          due_date: "2026-09-04",
          amount: "7400000",
          category: "supplier",
          is_overdue: false,
        },
      },
    });
    expect(sueldosEnRiesgo(s, HOY)).toBe(false);
    // Gemelo positivo: mismo label, sólo cambia el hecho estructural que entrega el backend.
    expect(sueldosEnRiesgo(conSueldos, HOY)).toBe(true);
  });
});

/* ── LEY 1 · un concepto, un número ──────────────────────────────────────────── */

describe("Ley 1 — el saldo de hoy sale de la MISMA fuente en V01 y en /caja", () => {
  const s = summary();

  it("el indicador Caja hoy de V01 es exactamente saldoCajaHoy(summary), formateado", () => {
    const cajaIndicador = indicadoresHoy(s).find((i) => i.label === "Caja hoy")!;
    expect(cajaIndicador.valor).toBe(formatClp(saldoCajaHoy(s)!));
    expect(cajaIndicador.valor).toBe("$9.800.000");
  });

  it("y lo sigue siendo con un saldo NEGATIVO (donde el signo cambia la lectura)", () => {
    const negativo = summary({
      cash_today: {
        total: "-1121250",
        last_updated: "2026-08-30T08:00:00Z",
        data_state: "available",
      },
    });
    const cajaIndicador = indicadoresHoy(negativo).find((i) => i.label === "Caja hoy")!;
    expect(cajaIndicador.valor).toBe(formatClp(saldoCajaHoy(negativo)!));
    expect(cajaIndicador.valor).toBe("−$1.121.250");
  });

  /* El test de arriba fija que V01 usa la fuente compartida. Éste fija el OTRO extremo: que
     `/caja` —el hero de V02, el que la Ley 1 nombra— también la usa, y que no volvió a
     desarmar el bloque por su cuenta.
     No se puede hacer renderizando: en `main` el proyecto `unit` de vitest no compila `.tsx`
     (tsconfig de Next fija `jsx: "preserve"`), y arreglarlo es el PR #63, abierto. Así que la
     afirmación se verifica sobre el CÓDIGO, que es donde de verdad se rompe: el defecto de
     `qavante-api#102` no fue un render, fue cada pantalla resolviendo su input. */
  const CAJA_V2 = "src/components/caja/v2/caja-v2-resumen-live.tsx";

  it("/caja resuelve su saldo por cajaHoy y no vuelve a leer cash_today a mano", () => {
    const src = readFileSync(CAJA_V2, "utf8");
    expect(src).toContain('from "@/lib/finanzas/caja-hoy"');
    expect(src).toContain("cajaHoy(dash.data)");
    // El gemelo negativo, con la forma exacta que tenía antes de este PR.
    expect(src).not.toContain("dash.data?.cash_today");
  });

  it("las dos pantallas leen el mismo campo del mismo endpoint", () => {
    // Sanity de que el negativo de arriba no pasa por vacío: el archivo existe y tiene contenido.
    expect(readFileSync(CAJA_V2, "utf8").length).toBeGreaterThan(1000);
    expect(cajaHoy(s).monto).toBe(9_800_000);
  });
});

/* ── Strip de indicadores ────────────────────────────────────────────────────── */

describe("strip de 4 indicadores (spec §V01 punto 6)", () => {
  it("son cuatro, en el orden de la spec", () => {
    expect(indicadoresHoy(summary()).map((i) => i.label)).toEqual([
      "Caja hoy",
      "Resultado mes",
      "Te deben",
      "Value Ledger",
    ]);
  });

  it("Value Ledger NO existe todavía: se declara el hueco, no se inventa un número", () => {
    const vl = indicadoresHoy(summary()).find((i) => i.label === "Value Ledger")!;
    expect(vl.valor).toBeNull();
    expect(vl.detalle).toContain("En preparación");
    expect(vl.href).toBeNull();
    // Gemelo positivo con el MISMO campo: el indicador de al lado sí trae valor y href.
    const caja = indicadoresHoy(summary()).find((i) => i.label === "Caja hoy")!;
    expect(caja.valor).toBe("$9.800.000");
    expect(caja.href).toBe("/caja");
  });

  it('"Te deben" con overdue null dice qué falta, y NUNCA $0', () => {
    const s = summary({
      overdue_collections: {
        total_receivable: "18500000",
        overdue: null,
        top_clients: [],
        last_updated: "2026-08-30T08:00:00Z",
        source: "sii_rcv",
      },
    });
    const i = indicadoresHoy(s).find((x) => x.label === "Te deben")!;
    expect(i.valor).toBeNull();
    expect(i.detalle).toContain("el SII aún no entrega los vencimientos");
    expect(i.detalle).toContain("$18.500.000");
    // Un $0 ahí diría "estás al día" sobre documentos cuya fecha no conocemos.
    expect(i.valor).not.toBe("$0");
  });

  it('"Te deben" con overdue conocido SÍ muestra el número (contrapeso del caso de arriba)', () => {
    const s = summary({
      overdue_collections: {
        total_receivable: "18500000",
        overdue: "7200000",
        top_clients: [],
        last_updated: "2026-08-30T08:00:00Z",
        source: "sii_rcv",
      },
    });
    const i = indicadoresHoy(s).find((x) => x.label === "Te deben")!;
    expect(i.valor).toBe("$7.200.000");
    expect(i.detalle).toContain("$18.500.000");
  });

  it("sin banco, Caja hoy dice qué hacer en vez de mostrar $0", () => {
    const i = indicadoresHoy(summary({ cash_today: null })).find((x) => x.label === "Caja hoy")!;
    expect(i.valor).toBeNull();
    expect(i.detalle).toBe("Conecta tu banco para verlo");
    expect(i.valor).not.toBe("$0");
  });

  it("un saldo stale se declara stale (no se pinta igual que uno fresco)", () => {
    const i = indicadoresHoy(
      summary({
        cash_today: { total: "9800000", last_updated: "2026-08-20T08:00:00Z", data_state: "stale" },
      }),
    ).find((x) => x.label === "Caja hoy")!;
    expect(i.valor).toBe("$9.800.000");
    expect(i.detalle).toBe("Puede estar desactualizado");
  });
});

/* ── Crumb ───────────────────────────────────────────────────────────────────── */

describe("crumb (fecha + empresa + frescura del banco)", () => {
  it("fecha larga de la spec, empresa y frescura relativa", () => {
    const c = crumbHoy("Tooxs Digital SpA", cajaHoy(summary()), HOY);
    expect(c.fecha).toBe("30 ago 2026");
    expect(c.empresa).toBe("Tooxs Digital SpA");
    expect(c.banco).toBe("Banco actualizado hoy");
    expect(c.bancoConReparo).toBe(false);
  });

  it("sin razón social cae en un genérico, no en un vacío", () => {
    expect(crumbHoy(null, cajaHoy(summary()), HOY).empresa).toBe("Tu empresa");
    expect(crumbHoy("   ", cajaHoy(summary()), HOY).empresa).toBe("Tu empresa");
  });

  it("un saldo viejo lleva reparo (contrapeso: el fresco NO lo lleva)", () => {
    const viejo = cajaHoy(
      summary({
        cash_today: { total: "9800000", last_updated: "2026-08-20T08:00:00Z", data_state: "stale" },
      }),
    );
    const c = crumbHoy("Tooxs", viejo, HOY);
    expect(c.banco).toBe("Banco actualizado hace 10 días");
    expect(c.bancoConReparo).toBe(true);
    expect(crumbHoy("Tooxs", cajaHoy(summary()), HOY).bancoConReparo).toBe(false);
  });

  it("sin saldo, el crumb lo dice", () => {
    const c = crumbHoy("Tooxs", cajaHoy(summary({ cash_today: null })), HOY);
    expect(c.banco).toBe("Banco sin dato de saldo");
    expect(c.bancoConReparo).toBe(true);
  });
});

/* ── Subtítulo ───────────────────────────────────────────────────────────────── */

describe("subtítulo de contexto (máximo 2 líneas)", () => {
  it("dos líneas: cuánta caja hay y a dónde llega", () => {
    const v = veredictoHoy(summary(CAJA_BAJO_CERO), HOY);
    expect(v.contexto).toHaveLength(2);
    expect(v.contexto[0]).toBe("Hoy tienes $9.800.000 en caja.");
    expect(v.contexto[1]).toBe("En los próximos 14 días tu caja llega a −$1.121.250.");
  });

  it("nunca pasa de dos líneas", () => {
    const s = summary({ ...CAJA_BAJO_CERO, critical_payments: SUELDOS_EN_5_DIAS });
    expect(veredictoHoy(s, HOY).contexto.length).toBeLessThanOrEqual(2);
  });

  it("sin saldo lo dice en vez de callarse", () => {
    const v = veredictoHoy(summary({ cash_today: null }), HOY);
    expect(v.contexto[0]).toBe("Todavía no sabemos cuánta caja tienes: falta el saldo del banco.");
    expect(v.contexto[0]).not.toContain("$0");
  });

  it("un pago vencido se nombra como tal, nunca como lo próximo", () => {
    const s = summary({
      critical_payments: {
        due_7d: "0",
        due_14d: "0",
        next_critical: {
          label: "Factura atrasada",
          due_date: "2026-08-01",
          amount: "1000",
          category: "supplier",
          is_overdue: true,
        },
        next_payroll: null,
        last_updated: "2026-08-30T08:00:00Z",
        source: "sii_rcv",
      },
    });
    const lineas = contextoHoy(s, cajaHoy(s));
    expect(lineas[1]).toBe("El pago más vencido es Factura atrasada, del 1 ago.");
    expect(lineas[1]).not.toContain("Lo próximo que vence");
  });

  it.each([
    [false, "Lo próximo que vence es Factura con estado, el 4 sep."],
    [true, "El pago más vencido es Factura con estado, del 4 sep."],
    [undefined, "No sabemos si Factura con estado está vencido: falta ese estado del pago."],
    ["false", "No sabemos si Factura con estado está vencido: falta ese estado del pago."],
  ])("publica el contexto estricto para is_overdue=%s", (is_overdue, esperado) => {
    const proximo = {
      label: "Factura con estado",
      due_date: "2026-09-04",
      amount: "1000",
      category: "supplier",
      ...(is_overdue === undefined ? {} : { is_overdue }),
    } as NonNullable<NonNullable<DashboardSummaryV2["critical_payments"]>["next_critical"]>;
    const s = summary({
      critical_payments: {
        due_7d: "0",
        due_14d: "0",
        next_critical: proximo,
        next_payroll: null,
        last_updated: "2026-08-30T08:00:00Z",
        source: "sii_rcv",
      },
    });

    const lineas = contextoHoy(s, cajaHoy(s));
    expect(lineas[1]).toBe(esperado);
    if (typeof is_overdue !== "boolean") expect(lineas[1]).not.toContain("Lo próximo que vence");
  });
});
