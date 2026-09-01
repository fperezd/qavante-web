/* Fixtures compartidas por los tests y las stories de V02 · Caja. Sólo datos: nada se formatea
 * acá (el lint del rediseño §5.8 corre sobre este archivo). Las cifras son inventadas con la
 * forma del contrato vivo (`src/lib/api/types.ts`), no datos de un tenant. */

import type { DashboardSummaryV2 } from "@/lib/api/dashboard";
import type { CashProjectionResponse, CollectionForecastResponse } from "@/lib/api/treasury";
import type { AccountsPayableResponse } from "@/lib/api/pagos";
import type { UnclassifiedSummary } from "@/lib/api/treasury";

export const HOY = new Date("2026-08-30T12:00:00Z");
export const AS_OF = "2026-08-30";

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

export function proyeccion(over: Partial<CashProjectionResponse> = {}): CashProjectionResponse {
  return {
    as_of: AS_OF,
    horizon_days: 28,
    moneda: "CLP",
    saldo_hoy: "9800000",
    minimo: "0",
    en_sobregiro: false,
    dias_de_caja: null,
    saldo_final: "9800000",
    serie: serie(28, () => 9_800_000),
    escenario_duro: { dias_de_caja: null, piso: "9800000", piso_fecha: AS_OF },
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
      { glosa: "Tradolarpeso", monto: "-674473", tipo: "pago", fecha: "2026-09-07" },
      {
        glosa: "Soc. de Profesionales Vásquez y Cía.",
        monto: "-483766",
        tipo: "pago",
        fecha: "2026-09-07",
      },
      { glosa: "F29 · IVA agosto", monto: "-174979", tipo: "f29", fecha: "2026-09-12" },
      {
        glosa: "Inmobiliaria Vista Kennedy",
        monto: "-88619",
        tipo: "pago_vencido",
        fecha: "2026-09-07",
      },
    ],
  },
  por_cobrar_vencido: { total: "39600000", n: 17 },
  fuentes: {
    saldo_synced_at: "2026-08-30T08:12:00Z",
    calidad_fechas: { con_fecha_real: 0.75, items_totales: 12 },
  },
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
        amount: "674473",
        criticality: "medium",
        source: "SII",
        currency: "CLP",
      },
      {
        label: "Soc. de Profesionales Vásquez y Cía.",
        category: "supplier",
        due_date: "2026-09-07",
        amount: "325527",
        criticality: "medium",
        source: "SII",
        currency: "CLP",
      },
      {
        label: "F29 · IVA agosto",
        category: "tax",
        due_date: "2026-09-12",
        amount: "174979",
        criticality: "high",
        source: "SII",
        currency: "CLP",
      },
      {
        label: "Sueldos de agosto",
        category: "payroll",
        due_date: "2026-09-04",
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
        amount: "1500000",
        criticality: "medium",
        source: "Manual",
        currency: "CLP",
      },
    ],
    projected_cash_14d: "-1121250",
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
