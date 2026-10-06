/* Fixtures compartidas por los tests y las stories de V02 · Caja. Sólo datos: nada se formatea
 * acá (el lint del rediseño §5.8 corre sobre este archivo). Las cifras son inventadas con la
 * forma del contrato vivo (`src/lib/api/types.ts`), no datos de un tenant. */

import type { DashboardSummaryV2 } from "@/lib/api/dashboard";
import type { CashProjectionResponse, CollectionForecastResponse } from "@/lib/api/treasury";
import type { AccountsPayableResponse } from "@/lib/api/pagos";
import type { UnclassifiedSummary } from "@/lib/api/treasury";

export const HOY = new Date("2026-08-30T12:00:00Z");
export const AS_OF = "2026-08-30";

/** Cobertura con todo medido en cero: el backend corrió y no declara exclusiones. */
export const COBERTURA_SIN_EXCLUSIONES = {
  cuotas_agendadas: "0",
  cuotas_agendadas_count: "0",
  cuotas_en_payables: "0",
  cuotas_en_payables_count: "0",
  impactos_committed_agendados: "0",
  impactos_committed_agendados_count: "0",
  moneda_distinta_cuotas_excluidas: "0",
  f29_legacy_unattributed: false,
  f29_omitido_por_moneda: false,
  moneda_distinta_excluidos: "0",
  payables_fecha_asumida_excluidos: "0",
  payables_fecha_asumida_excluidos_count: "0",
  payables_fecha_no_verificada_excluidos: "0",
  payables_fecha_no_verificada_excluidos_count: "0",
  receivables_fecha_asumida_excluidos: "0",
  receivables_fecha_asumida_excluidos_count: "0",
  receivables_fecha_no_verificada_excluidos: "0",
  receivables_fecha_no_verificada_excluidos_count: "0",
  sin_fecha_excluidos: "0",
};

export function summary(over: Partial<DashboardSummaryV2> = {}): DashboardSummaryV2 {
  return {
    executive_phrase: null,
    pulso: null,
    cash_today: {
      total: "9800000",
      last_updated: "2026-08-30T08:12:00Z",
      data_state: "available",
    },
    cash_forecast: null,
    cash_gap: null,
    overdue_collections: null,
    critical_payments: null,
    operational_result: null,
    priority_actions: [],
    generated_at: "2026-08-30T08:12:00Z",
    ...over,
  } as DashboardSummaryV2;
}

/** Serie diaria de `dias` días desde `AS_OF`, con el saldo de cierre que devuelva `saldoDelDia`. */
export function serie(dias: number, saldoDelDia: (dia: number) => number) {
  const base = Date.UTC(2026, 7, 30);
  return Array.from({ length: dias }, (_, i) => {
    const dia = i + 1;
    return {
      fecha: new Date(base + dia * 86_400_000).toISOString().slice(0, 10),
      saldo_cierre: String(saldoDelDia(dia)),
      capa: "esperado",
    };
  });
}

/** `vencido_exigible` sin stock: el escenario corrió y no hay deuda vencida (cero medido). */
const SIN_VENCIDO_EXIGIBLE = {
  total: "0",
  n: 0,
  moneda: "CLP",
  en_la_curva: false as const,
  desde_dias: 90,
  mora_estructural: { total: "0", n: 0 },
  plan_de_pago: {
    compromiso_vigente: "0",
    compromiso_vigente_n: 0,
    compromiso_incumplido: "0",
    compromiso_incumplido_n: 0,
  },
};

/** El piso que publica el productor, con la forma de `PuntoMasBajo`. */
function puntoMasBajo(over: { fecha?: string; saldo?: string; minimo?: string } = {}) {
  const minimo = over.minimo ?? "0";
  const saldo = over.saldo ?? "9800000";
  const brecha = Math.max(0, Number(minimo) - Number(saldo));
  return {
    fecha: over.fecha ?? AS_OF,
    saldo,
    minimo,
    horizon_days: 28,
    bajo_minimo: Number(saldo) < Number(minimo),
    brecha: String(brecha),
    vencido_exigible_excluido: "0",
  };
}

export function proyeccion(over: Partial<CashProjectionResponse> = {}): CashProjectionResponse {
  return {
    as_of: AS_OF,
    horizon_days: 28,
    moneda: "CLP",
    saldo_hoy: "9800000",
    minimo: "0",
    en_sobregiro: false,
    dias_de_caja: null,
    dias_de_caja_vencido_exigible_excluido: "0",
    saldo_final: "9800000",
    serie: serie(28, () => 9_800_000),
    punto_mas_bajo: puntoMasBajo(),
    vencido_exigible: SIN_VENCIDO_EXIGIBLE,
    escenario_duro: {
      dias_de_caja: null,
      piso: "9800000",
      piso_fecha: AS_OF,
      punto_mas_bajo: puntoMasBajo(),
    },
    escenario_condicionado: {
      dias_de_caja: null,
      saldo_final: "9800000",
      n_flujos: 0,
      total_cobros_condicionados: "0",
      total_pagos_condicionados: "0",
      vencido_exigible: SIN_VENCIDO_EXIGIBLE,
    },
    esperado_con_recuperacion: {
      saldo_final: "9800000",
      recuperacion_days: 30,
      total_recuperado: "0",
    },
    esperado_con_ingresos: {
      saldo_final: "9800000",
      total_ingreso_proyectado: "0",
      n_flujos: 0,
    },
    punto_quiebre: null,
    vencido: { total: "0", items: [] },
    por_cobrar_vencido: { total: "0", n: 0 },
    por_pagar_vencido: { total: "0", n: 0 },
    fuentes: {
      saldo_synced_at: "2026-08-30T08:12:00Z",
      calidad_fechas: { con_fecha_real: 1, items_totales: 12 },
      cobertura: COBERTURA_SIN_EXCLUSIONES,
    },
    ...over,
  };
}

/** Semana 1 sube +3,4M; semana 2 cae −9,6M hasta −1.121.250 el 7 sep; después recupera. */
export const PROYECCION_BAJO_CERO: CashProjectionResponse = proyeccion({
  saldo_hoy: "5078750",
  saldo_final: "3300000",
  serie: serie(28, (dia) => {
    if (dia <= 7) return 5_078_750 + 3_400_000;
    if (dia <= 14) return 8_478_750 - 9_600_000; // −1.121.250: el piso, desde el día 8 (7 sep)
    if (dia <= 21) return 2_878_750;
    return 3_300_000;
  }),
  punto_quiebre: {
    fecha: "2026-09-07",
    saldo: "-1121250",
    causas: [
      {
        glosa: "Tradolarpeso",
        monto: "-674473",
        tipo: "pago",
        fecha: "2026-09-07",
        payable_id: "11111111-1111-4111-8111-111111111111",
      },
      {
        glosa: "Soc. de Profesionales Vásquez y Cía.",
        monto: "-483766",
        tipo: "pago",
        fecha: "2026-09-07",
        payable_id: "22222222-2222-4222-8222-222222222222",
      },
      { glosa: "F29 · IVA agosto", monto: "-174979", tipo: "f29", fecha: "2026-09-12" },
      {
        glosa: "Inmobiliaria Vista Kennedy",
        monto: "-88619",
        tipo: "pago_vencido",
        fecha: "2026-09-07",
        payable_id: "33333333-3333-4333-8333-333333333333",
      },
    ],
  },
  /* El piso lo publica el productor: el mismo −1.121.250 del 7 sep que la serie dibuja, pero
     afirmado por quien lo define en vez de buscado por la pantalla. */
  punto_mas_bajo: puntoMasBajo({ fecha: "2026-09-07", saldo: "-1121250" }),
  por_cobrar_vencido: { total: "39600000", n: 17 },
  fuentes: {
    saldo_synced_at: "2026-08-30T08:12:00Z",
    calidad_fechas: { con_fecha_real: 0.75, items_totales: 12 },
    cobertura: COBERTURA_SIN_EXCLUSIONES,
  },
});

/** El caso que antes se pintaba verde: el piso NO baja de cero, pero SÍ del mínimo declarado.
 *  Mínimo $5.000.000, piso $1.200.000 el 7 sep ⇒ `bajo_minimo` con brecha $3.800.000. */
export const PROYECCION_BAJO_EL_MINIMO: CashProjectionResponse = proyeccion({
  minimo: "5000000",
  saldo_hoy: "9800000",
  saldo_final: "1200000",
  serie: serie(28, (dia) => (dia <= 7 ? 9_800_000 : 1_200_000)),
  punto_mas_bajo: puntoMasBajo({
    fecha: "2026-09-07",
    saldo: "1200000",
    minimo: "5000000",
  }),
});

export function cobranza(
  over: Partial<CollectionForecastResponse> = {},
): CollectionForecastResponse {
  return {
    as_of: AS_OF,
    total_nominal: "30000000",
    total_expected: "24000000",
    overdue: { nominal: "7200000", expected: "3600000" },
    sin_vencimiento: { nominal: "0", expected: "0" },
    buckets: [
      { label: "0-7d", days_from: 0, days_to: 7, nominal: "8000000", expected: "7000000" },
      { label: "8-14d", days_from: 8, days_to: 14, nominal: "8500000", expected: "7498964" },
      { label: "15-30d", days_from: 15, days_to: 30, nominal: "6300000", expected: "5901036" },
    ],
    beyond_horizon: { nominal: "0", expected: "0" },
    /* `ventana_14d` se volvió requerida en el contrato (arrastre del sync que trae api#1126).
       No la lee todavía ninguna pantalla; se completa derivada de las MISMAS cifras de arriba
       para que el fixture no se contradiga: vencido = `overdue`, confirmado = buckets 0-14,
       fuera_de_ventana = bucket 15-30 + `beyond_horizon`, y las cinco ramas suman exacto
       `cartera_total` (30.000.000 nominal / 24.000.000 esperado). */
    ventana_14d: {
      dias: 14,
      currency_code: "CLP",
      monedas_excluidas: [],
      confirmado: { nominal: "16500000", expected: "14498964" },
      condicional: { nominal: "0", expected: "0" },
      vencido: { nominal: "7200000", expected: "3600000" },
      sin_vencimiento: { nominal: "0", expected: "0" },
      fuera_de_ventana: { nominal: "6300000", expected: "5901036" },
      cartera_total: { nominal: "30000000", expected: "24000000" },
      sin_vencimiento_count: 0,
      total_count: 3,
      cubre:
        "Cubre los 3 documentos vivos en pesos de la cartera, los 14 días corridos desde la fecha de corte.",
    },
    ...over,
  };
}

export function pagos(over: Partial<AccountsPayableResponse> = {}): AccountsPayableResponse {
  return {
    total: "60000000",
    due_7d: "20000000",
    due_14d: "35532396",
    due_30d: "48000000",
    items: [
      {
        label: "Tradolarpeso",
        category: "supplier",
        due_date: "2026-09-07",
        due_date_certainty: "confirmed",
        amount: "674473",
        criticality: "medium",
        source: "SII",
        currency: "CLP",
      },
      {
        label: "Soc. de Profesionales Vásquez y Cía.",
        category: "supplier",
        due_date: "2026-09-07",
        due_date_certainty: "confirmed",
        amount: "325527",
        criticality: "medium",
        source: "SII",
        currency: "CLP",
      },
      {
        label: "F29 · IVA agosto",
        category: "tax",
        due_date: "2026-09-12",
        due_date_certainty: "confirmed",
        amount: "174979",
        criticality: "high",
        source: "SII",
        currency: "CLP",
      },
      {
        label: "Sueldos de agosto",
        category: "payroll",
        due_date: "2026-09-04",
        due_date_certainty: "confirmed",
        amount: "7400000",
        criticality: "high",
        source: "BUK",
        currency: "CLP",
      },
      {
        // Vence a 20 días: NO entra en la ventana de 14.
        label: "Arriendo oficina",
        category: "rent",
        due_date: "2026-09-19",
        due_date_certainty: "confirmed",
        amount: "1500000",
        criticality: "medium",
        source: "Manual",
        currency: "CLP",
      },
    ],
    projected_cash_14d: "-1121250",
    /* El agregado ejecutable de la Ley 9 sobre TODO el registro (contrato D02): F29 174.979 +
       sueldos 7.400.000 vencen dentro de 14 días y no se postergan; nada vencido todavía. Es lo
       que "Sale · 14 días" muestra como críticos, sin sumar `items` (#302 P2-6). */
    non_postponable_or_overdue_14d: {
      amount_clp: "7574979",
      known_amount_clp: "7574979",
      complete: true,
      count: 2,
      unknown_due_date_count: 0,
      excluded_by_currency: [],
    },
    covers_critical: false,
    confidence: "high",
    data_state: "available",
    generated_at: "2026-08-30T08:12:00Z",
    ...over,
  };
}

export function sinClasificar(over: Partial<UnclassifiedSummary> = {}): UnclassifiedSummary {
  return {
    count: 3,
    inflowByCurrency: [{ currency: "CLP", inflow: 2_100_000, count: 3 }],
    unknownCurrencyCount: 0,
    unknownInflowCount: 0,
    isLoading: false,
    isError: false,
    ...over,
  };
}
