/* Fixtures compartidas por los tests y las stories de V05 · Pagar. Sólo datos: nada se formatea
 * acá (el lint del rediseño §5.8 corre sobre este archivo). Las cifras son inventadas con la forma
 * del contrato vivo (`src/lib/api/types.ts` + `payables_repo.py`), no datos de un tenant:
 * `items` sólo con `due_date` (el backend filtra los sin fecha a `undated_*`), ordenados por
 * `due_date asc`, `source_external_id` con la clave natural del RCV ('tipo-folio-rut') o la de
 * nómina ('payroll-YYYYMM'), y los `due_*` acumulativos INCLUYENDO lo vencido. */

import type {
  D02AccountsPayableResponse as AccountsPayableResponse,
  PayableAggregateSummary,
  PayableDuplicatePair,
  PayableItem,
} from "@/lib/api/pagos";

export const HOY = new Date("2026-08-30T12:00:00Z");

export const RUT_KENNEDY = "76222222-2";
export const RUT_VASQUEZ = "76333333-3";
export const RUT_CHIPAX = "76444444-4";
export const RUT_ENTEL = "76555555-5";
export const RUT_MELI = "76666666-6";

/** Los fixtures D02 representan payloads ya validados por el boundary HTTP. */
function withVerifiedFixtureCurrency(response: AccountsPayableResponse): AccountsPayableResponse {
  const withStatus = <T extends { currency?: string | null; currency_status?: string }>(
    entry: T,
  ): T =>
    entry.currency_status === undefined && entry.currency != null
      ? { ...entry, currency_status: "verified" }
      : entry;
  return {
    ...response,
    items: response.items?.map(withStatus),
    total_by_currency: response.total_by_currency?.map(withStatus),
    excluded_from_total_by_currency: response.excluded_from_total_by_currency?.map(withStatus),
    next_payroll: response.next_payroll ? withStatus(response.next_payroll) : response.next_payroll,
  };
}

function aggregate(
  amount: string | null,
  count: number,
  over: Partial<PayableAggregateSummary> = {},
): PayableAggregateSummary {
  return {
    amount_clp: amount,
    known_amount_clp: amount ?? "0",
    complete: amount !== null,
    count,
    unknown_due_date_count: 0,
    excluded_by_currency: [],
    ...over,
  };
}

/* La factura vencida hace ~18 meses (545 días): el caso VIVO de producción — el backend ordena
 * por `due_date asc` e incluye lo vencido, así que esto es lo primero que llega. */
export const KENNEDY: PayableItem = {
  id: "00000000-0000-4000-8000-000000000001",
  label: "Inmobiliaria Vista Kennedy SpA · Factura 1201",
  category: "supplier",
  due_date: "2025-03-03",
  due_date_certainty: "confirmed",
  amount: "7078882",
  criticality: "high",
  source: "SII",
  source_external_id: "33-1201-76222222-2",
  counterparty_name: "Inmobiliaria Vista Kennedy SpA",
  counterparty_rut: RUT_KENNEDY,
  folio: 1201,
  tipo_dte: 33,
  currency: "CLP",
  amount_clp: null,
};

export const VASQUEZ: PayableItem = {
  id: "00000000-0000-4000-8000-000000000002",
  label: "Soc. de Profesionales Vásquez, González y Cía. · Factura 88",
  category: "supplier",
  due_date: "2026-06-06",
  due_date_certainty: "confirmed",
  amount: "1447161",
  criticality: "high",
  source: "SII",
  source_external_id: "33-88-76333333-3",
  counterparty_name: "Soc. de Profesionales Vásquez, González y Cía.",
  counterparty_rut: RUT_VASQUEZ,
  folio: 88,
  tipo_dte: 33,
  currency: "CLP",
  amount_clp: null,
};

export const ENTEL_A: PayableItem = {
  id: "00000000-0000-4000-8000-000000000003",
  label: "Entel PCS Telecomunicaciones S.A. · Factura 9001",
  category: "supplier",
  due_date: "2026-08-12",
  due_date_certainty: "confirmed",
  amount: "203607",
  criticality: "high",
  source: "SII",
  source_external_id: "33-9001-76555555-5",
  counterparty_name: "Entel PCS Telecomunicaciones S.A.",
  counterparty_rut: RUT_ENTEL,
  folio: 9001,
  tipo_dte: 33,
  currency: "CLP",
  amount_clp: null,
};

/** La contraparte del par UUID que publica el registro de anomalías. */
export const ENTEL_B: PayableItem = {
  id: "00000000-0000-4000-8000-000000000004",
  label: "Entel PCS Telecomunicaciones S.A. · Factura 9017",
  category: "supplier",
  due_date: "2026-08-27",
  due_date_certainty: "confirmed",
  amount: "205000",
  criticality: "high",
  source: "SII",
  source_external_id: "33-9017-76555555-5",
  counterparty_name: "Entel PCS Telecomunicaciones S.A.",
  counterparty_rut: RUT_ENTEL,
  folio: 9017,
  tipo_dte: 33,
  currency: "CLP",
  amount_clp: null,
};

export const BICE: PayableItem = {
  id: "00000000-0000-4000-8000-000000000005",
  label: "Banco BICE · cuota crédito",
  category: "debt",
  due_date: "2026-09-01",
  due_date_certainty: "confirmed",
  amount: "503076",
  criticality: "high",
  source: "Manual",
  source_external_id: "obligation-77",
  counterparty_name: "Banco BICE",
  counterparty_rut: null,
  folio: null,
  tipo_dte: null,
  currency: "CLP",
  amount_clp: null,
};

/* ADR-0056: la nómina es un payable REAL. El backend manda el label literal "Remuneraciones"
 * (supplier_name sin documento) y la clave natural trae el período. */
export const REMUNERACIONES: PayableItem = {
  id: "00000000-0000-4000-8000-000000000006",
  label: "Remuneraciones",
  category: "payroll",
  due_date: "2026-09-04",
  due_date_certainty: "confirmed",
  amount: "7400000",
  criticality: "high",
  source: "BUK",
  source_external_id: "payroll-202608",
  counterparty_name: "Remuneraciones",
  counterparty_rut: null,
  folio: null,
  tipo_dte: null,
  currency: "CLP",
  amount_clp: null,
};

export const MELI_USD: PayableItem = {
  id: "00000000-0000-4000-8000-000000000007",
  label: "MercadoLibre Chile Ltda. · Factura 77",
  category: "supplier",
  due_date: "2026-09-08",
  due_date_certainty: "confirmed",
  amount: "1240",
  criticality: "medium",
  source: "SII",
  source_external_id: "33-77-76666666-6",
  counterparty_name: "MercadoLibre Chile Ltda.",
  counterparty_rut: RUT_MELI,
  folio: 77,
  tipo_dte: 33,
  currency: "USD",
  amount_clp: "1190400",
};

export const F29: PayableItem = {
  id: "00000000-0000-4000-8000-000000000008",
  label: "F29 · IVA de julio",
  category: "tax",
  due_date: "2026-09-12",
  due_date_certainty: "confirmed",
  amount: "174979",
  criticality: "medium",
  source: "SII",
  source_external_id: "f29-202607",
  counterparty_name: null,
  counterparty_rut: null,
  folio: null,
  tipo_dte: null,
  currency: "CLP",
  amount_clp: null,
};

export const CHIPAX: PayableItem = {
  id: "00000000-0000-4000-8000-000000000009",
  label: "Chipax SpA · Factura 5540",
  category: "supplier",
  due_date: "2026-09-20",
  due_date_certainty: "confirmed",
  amount: "1207105",
  criticality: "low",
  source: "SII",
  source_external_id: "33-5540-76444444-4",
  counterparty_name: "Chipax SpA",
  counterparty_rut: RUT_CHIPAX,
  folio: 5540,
  tipo_dte: 33,
  currency: "CLP",
  amount_clp: null,
};

/* Certeza de la fecha (contrato #558): los tres valores, con la nota server-owned tal cual. */

/** `estimated` con nota: el registro estimó el vencimiento a 30 días desde la emisión. */
export const TELEFONICA_ESTIMADA: PayableItem = {
  id: "00000000-0000-4000-8000-000000000013",
  label: "Telefónica Chile S.A. · Factura 4471",
  category: "supplier",
  due_date: "2026-09-03",
  due_date_certainty: "estimated",
  due_date_note:
    "Fecha estimada a 30 días desde la emisión; el documento no trae vencimiento pactado.",
  amount: "890000",
  criticality: "medium",
  source: "SII",
  source_external_id: "33-4471-76999999-9",
  counterparty_name: "Telefónica Chile S.A.",
  counterparty_rut: "76999999-9",
  folio: 4471,
  tipo_dte: 33,
  currency: "CLP",
  amount_clp: null,
};

/** `estimated` en un IMPUESTO dentro de la ventana: confirmado sería crítico; estimado no. */
export const F29_ESTIMADO: PayableItem = {
  ...F29,
  id: "00000000-0000-4000-8000-000000000014",
  label: "F29 · IVA de agosto",
  due_date: "2026-09-05",
  due_date_certainty: "estimated",
  due_date_note: "El formulario aún no está emitido; la fecha es una estimación del registro.",
  criticality: "high",
  source_external_id: "f29-202608",
};

/** `unconfirmed` con fecha YA PASADA y nota vacía: ni ámbar ni "vencido", y ninguna nota
 *  inventada — la pill sola dice el estado. */
export const ARRIENDO_SIN_CONFIRMAR: PayableItem = {
  id: "00000000-0000-4000-8000-000000000015",
  label: "Arriendo oficina",
  category: "rent",
  due_date: "2026-08-20",
  due_date_certainty: "unconfirmed",
  due_date_note: "",
  amount: "1300000",
  criticality: "medium",
  source: "Manual",
  source_external_id: "obligation-81",
  counterparty_name: "Inmobiliaria Los Leones Ltda.",
  counterparty_rut: null,
  folio: null,
  tipo_dte: null,
  currency: "CLP",
  amount_clp: null,
};

/** Caso NORMAL: una página de 8 pagos y agregados globales de 3 vencidos ($8.729.650) y
 *  6 críticos ($16.807.705), separados del saldo final proyectado de $5.200.000;
 *  `covers_critical=false` viene del backend. $1.190.400 negociable en 14 días (la factura USD,
 *  convertida); nada sin fecha; sin duplicados. */
export function pagos(over: Partial<AccountsPayableResponse> = {}): AccountsPayableResponse {
  const response: AccountsPayableResponse = {
    total: "19205210",
    total_by_currency: [
      { currency: "CLP", amount: "18014810", currency_status: "verified" },
      { currency: "USD", amount: "1240", currency_status: "verified" },
    ],
    due_7d: "16632726",
    due_14d: "17998105",
    due_30d: "19205210",
    excluded_from_total_by_currency: [],
    undated_amount: "0",
    undated_count: 0,
    estimated_due_date_count: 0,
    undated_summary: aggregate("0", 0),
    items: [KENNEDY, VASQUEZ, ENTEL_A, BICE, REMUNERACIONES, MELI_USD, F29, CHIPAX],
    items_total: 8,
    limit: 100,
    has_more: false,
    next_cursor: null,
    overdue_summary: aggregate("8729650", 3),
    non_postponable_or_overdue_14d: aggregate("16807705", 6),
    by_category: [
      { ...aggregate("11127155", 5), category: "supplier" },
      { ...aggregate("174979", 1), category: "tax" },
      { ...aggregate("7400000", 1), category: "payroll" },
      { ...aggregate("0", 0), category: "rent" },
      { ...aggregate("503076", 1), category: "debt" },
      { ...aggregate("0", 0), category: "leasing" },
      { ...aggregate("0", 0), category: "other" },
    ],
    credits: aggregate("0", 0),
    zero_balance_count: 0,
    filter_metadata: {
      unfiltered_items_total: 8,
      matched_items_total: 8,
      by_category: [
        { category: "supplier", count: 5 },
        { category: "tax", count: 1 },
        { category: "payroll", count: 1 },
        { category: "rent", count: 0 },
        { category: "debt", count: 1 },
        { category: "leasing", count: 0 },
        { category: "other", count: 0 },
      ],
      by_criticality: [
        { criticality: "high", count: 5 },
        { criticality: "medium", count: 2 },
        { criticality: "low", count: 1 },
      ],
      by_state: [
        { state: "open", count: 8 },
        { state: "partially_paid", count: 0 },
      ],
    },
    payroll_coverage: {
      complete: true,
      sources: [
        {
          source: "buk",
          status: "ready",
          last_success_at: "2026-08-30T08:00:00Z",
          freshness_confirmed: true,
          covered: true,
        },
        {
          source: "previred",
          status: "ready",
          last_success_at: "2026-08-30T08:00:00Z",
          freshness_confirmed: true,
          covered: true,
        },
      ],
    },
    as_of: "2026-08-30",
    snapshot_id: "a".repeat(64),
    next_payroll: {
      label: "Remuneraciones",
      category: "payroll",
      due_date: "2026-09-04",
      amount: "7400000",
      currency: "CLP",
      currency_status: "verified",
      amount_clp: null,
      is_overdue: false,
    },
    projected_cash_14d: "5200000",
    projected_cash_currency: "CLP",
    min_14d: "-1200000",
    cash_gap_amount_14d: "1200000",
    has_gap: true,
    cash_projection_publicable_14d: true,
    covers_critical: false,
    confidence: "high",
    data_state: "available",
    missing_sources: [],
    generated_at: "2026-08-30T08:12:00Z",
    ...over,
  };
  return withVerifiedFixtureCurrency({
    ...response,
    items: response.items?.map((item) => ({
      ...item,
      reclamado: item.reclamado ?? false,
    })),
  });
}

/** Los TRES valores de certeza en una página: dos fechas estimadas (una de ellas un impuesto que
 *  confirmado sería crítico), una sin confirmar ya pasada y sin nota, y tres confirmadas. Los
 *  agregados siguen al contrato: lo estimado NO entra en `due_*`, en `overdue_summary` ni en el
 *  agregado crítico, y `estimated_due_date_count` lo cuenta aparte. El arriendo sin confirmar
 *  tampoco se suma acá: el fixture no afirma cómo lo trata el servidor, sólo que el front no lo
 *  convierte en mora. */
export function pagosConFechasEstimadas(
  over: Partial<AccountsPayableResponse> = {},
): AccountsPayableResponse {
  return pagos({
    total: "11154042",
    total_by_currency: [{ currency: "CLP", amount: "11154042", currency_status: "verified" }],
    due_7d: "7581958",
    due_14d: "7581958",
    due_30d: "8789063",
    estimated_due_date_count: 2,
    items: [KENNEDY, ARRIENDO_SIN_CONFIRMAR, TELEFONICA_ESTIMADA, BICE, F29_ESTIMADO, CHIPAX],
    items_total: 6,
    overdue_summary: aggregate("7078882", 1),
    non_postponable_or_overdue_14d: aggregate("7581958", 2),
    by_category: [
      { ...aggregate("9175987", 3), category: "supplier" },
      { ...aggregate("174979", 1), category: "tax" },
      { ...aggregate("0", 0), category: "payroll" },
      { ...aggregate("1300000", 1), category: "rent" },
      { ...aggregate("503076", 1), category: "debt" },
      { ...aggregate("0", 0), category: "leasing" },
      { ...aggregate("0", 0), category: "other" },
    ],
    filter_metadata: {
      unfiltered_items_total: 6,
      matched_items_total: 6,
      by_category: [
        { category: "supplier", count: 3 },
        { category: "tax", count: 1 },
        { category: "payroll", count: 0 },
        { category: "rent", count: 1 },
        { category: "debt", count: 1 },
        { category: "leasing", count: 0 },
        { category: "other", count: 0 },
      ],
      by_criticality: [
        { criticality: "high", count: 3 },
        { criticality: "medium", count: 2 },
        { criticality: "low", count: 1 },
      ],
      by_state: [
        { state: "open", count: 6 },
        { state: "partially_paid", count: 0 },
      ],
    },
    next_payroll: null,
    ...over,
  });
}

/** Valores exactos de la auditoría V2 D01 (#197). El pago crítico ya está
 * descontado en `projected_cash_14d`: jamás se suma a la brecha otra vez. */
export function pagosAuditoriaD01(): AccountsPayableResponse {
  const critico: PayableItem = {
    id: "00000000-0000-4000-8000-000000000197",
    label: "Pagos críticos de auditoría",
    category: "tax",
    due_date: "2026-09-10",
    due_date_certainty: "confirmed",
    amount: "10373669",
    criticality: "high",
    source: "Auditoría V2",
    currency: "CLP",
    amount_clp: null,
  };
  return pagos({
    total: "10373669",
    total_by_currency: undefined,
    due_7d: "10373669",
    due_14d: "10373669",
    due_30d: "10373669",
    items: [critico],
    items_total: 1,
    overdue_summary: aggregate("0", 0),
    non_postponable_or_overdue_14d: aggregate("10373669", 1),
    filter_metadata: {
      ...pagos().filter_metadata,
      unfiltered_items_total: 1,
      matched_items_total: 1,
    },
    projected_cash_14d: "-46865254",
    min_14d: "-46865254",
    cash_gap_amount_14d: "46865254",
    has_gap: true,
    projected_cash_currency: "CLP",
    covers_critical: false,
  });
}

/** Caso adversarial: los 100 visibles son negociables, pero el agregado global incluye una
 * obligación crítica 101 que no está en esta página. */
export function pagosListaTopeadaSinCriticos(): AccountsPayableResponse {
  const items = Array.from(
    { length: 100 },
    (_, i): PayableItem => ({
      ...KENNEDY,
      id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      label: `Proveedor negociable ${i + 1}`,
      source_external_id: `33-${i + 1}-76222222-2`,
      counterparty_name: `Proveedor negociable ${i + 1}`,
      folio: i + 1,
      amount: "1000",
    }),
  );
  return pagos({
    total: "100000",
    total_by_currency: undefined,
    due_7d: "100000",
    due_14d: "100000",
    due_30d: "100000",
    items,
    items_total: 101,
    non_postponable_or_overdue_14d: aggregate("250000", 1),
    projected_cash_14d: "1",
    covers_critical: false,
  });
}

/** Con el posible duplicado de Entel adentro (los `due_*` del backend lo suman también). */
export function pagosConDuplicado(
  over: Partial<AccountsPayableResponse> = {},
): AccountsPayableResponse {
  return pagos({
    total: "19410210",
    total_by_currency: [
      { currency: "CLP", amount: "18219810", currency_status: "verified" },
      { currency: "USD", amount: "1240", currency_status: "verified" },
    ],
    due_7d: "16837726",
    due_14d: "18203105",
    due_30d: "19410210",
    items: [KENNEDY, VASQUEZ, ENTEL_A, ENTEL_B, BICE, REMUNERACIONES, MELI_USD, F29, CHIPAX],
    items_total: 9,
    /* Los conteos de los chips los publica el servidor sobre TODO el registro (D02/D15): con una
       factura más que el caso normal, el agregado tiene que decir 9, no 8. */
    filter_metadata: {
      unfiltered_items_total: 9,
      matched_items_total: 9,
      by_category: [
        { category: "supplier", count: 6 },
        { category: "tax", count: 1 },
        { category: "payroll", count: 1 },
        { category: "rent", count: 0 },
        { category: "debt", count: 1 },
        { category: "leasing", count: 0 },
        { category: "other", count: 0 },
      ],
      by_criticality: [
        { criticality: "high", count: 5 },
        { criticality: "medium", count: 3 },
        { criticality: "low", count: 1 },
      ],
      by_state: [
        { state: "open", count: 9 },
        { state: "partially_paid", count: 0 },
      ],
    },
    ...over,
  });
}

export const ANOMALIA_ENTEL: PayableDuplicatePair = {
  payable_id: ENTEL_A.id!,
  duplicate_payable_id: ENTEL_B.id!,
};

/** SÓLO impuestos y sueldos: nada postergable (Ley 9), sin banner, sin rojo negociable. */
export function pagosSoloImpuestosYSueldos(
  over: Partial<AccountsPayableResponse> = {},
): AccountsPayableResponse {
  const previred: PayableItem = {
    id: "00000000-0000-4000-8000-000000000010",
    label: "Previred · cotizaciones",
    category: "payroll",
    due_date: "2026-09-10",
    due_date_certainty: "confirmed",
    amount: "1230000",
    criticality: "medium",
    source: "Previred",
    source_external_id: "previred-202608",
    counterparty_name: "Previred",
    counterparty_rut: null,
    folio: null,
    tipo_dte: null,
    currency: "CLP",
    amount_clp: null,
  };
  return pagos({
    total: "8804979",
    total_by_currency: undefined,
    due_7d: "7400000",
    due_14d: "8804979",
    due_30d: "8804979",
    items: [REMUNERACIONES, previred, F29],
    items_total: 3,
    /* Agregados coherentes con las 3 obligaciones del escenario: ninguna vencida al corte y las
       tres no postergables dentro de 14 días (Ley 9). Los chips y la tríada leen esto, no la
       tabla. */
    overdue_summary: aggregate("0", 0),
    non_postponable_or_overdue_14d: aggregate("8804979", 3),
    by_category: [
      { ...aggregate("0", 0), category: "supplier" },
      { ...aggregate("174979", 1), category: "tax" },
      { ...aggregate("8630000", 2), category: "payroll" },
      { ...aggregate("0", 0), category: "rent" },
      { ...aggregate("0", 0), category: "debt" },
      { ...aggregate("0", 0), category: "leasing" },
      { ...aggregate("0", 0), category: "other" },
    ],
    filter_metadata: {
      unfiltered_items_total: 3,
      matched_items_total: 3,
      by_category: [
        { category: "supplier", count: 0 },
        { category: "tax", count: 1 },
        { category: "payroll", count: 2 },
        { category: "rent", count: 0 },
        { category: "debt", count: 0 },
        { category: "leasing", count: 0 },
        { category: "other", count: 0 },
      ],
      by_criticality: [
        { criticality: "high", count: 1 },
        { criticality: "medium", count: 2 },
        { criticality: "low", count: 0 },
      ],
      by_state: [
        { state: "open", count: 3 },
        { state: "partially_paid", count: 0 },
      ],
    },
    projected_cash_14d: "9100000",
    min_14d: "1000000",
    cash_gap_amount_14d: "0",
    has_gap: false,
    covers_critical: true,
    ...over,
  });
}

/** Datos degradados: una fila que llega SIN fecha parseable (defensivo — el contrato dice que no
 *  pasa, la pantalla no puede decir "vence hoy" si pasa), una en USD sin tipo de cambio, y 3
 *  documentos sin fecha que el backend dejó fuera de la tabla (`undated_*`). La caja proyectada
 *  viene en la moneda funcional del tenant (USD): no se compara con pesos. */
export function pagosDegradados(
  over: Partial<AccountsPayableResponse> = {},
): AccountsPayableResponse {
  const sinFecha: PayableItem = {
    id: "00000000-0000-4000-8000-000000000011",
    label: "Aguas Cordillera S.A. · Factura 310",
    category: "supplier",
    due_date: "",
    due_date_certainty: "confirmed",
    amount: "96500",
    criticality: "low",
    source: "SII",
    source_external_id: "33-310-76777777-7",
    counterparty_name: "Aguas Cordillera S.A.",
    counterparty_rut: "76777777-7",
    folio: 310,
    tipo_dte: 33,
    currency: "CLP",
    amount_clp: null,
  };
  const usdSinTc: PayableItem = {
    id: "00000000-0000-4000-8000-000000000012",
    label: "Amazon Web Services · Factura 4410",
    category: "supplier",
    due_date: "2026-09-05",
    due_date_certainty: "confirmed",
    amount: "830",
    criticality: "high",
    source: "SII",
    source_external_id: "33-4410-76888888-8",
    counterparty_name: "Amazon Web Services",
    counterparty_rut: "76888888-8",
    folio: 4410,
    tipo_dte: 33,
    currency: "USD",
    amount_clp: null,
  };
  return pagos({
    total: "12071716",
    total_by_currency: [
      { currency: "CLP", amount: "12071716", currency_status: "verified" },
      { currency: "USD", amount: "830", currency_status: "verified" },
    ],
    due_7d: "9350237",
    due_14d: "9525216",
    due_30d: "9525216",
    undated_amount: "2450000",
    undated_count: 3,
    undated_summary: aggregate("2450000", 3),
    items: [VASQUEZ, sinFecha, usdSinTc, BICE, REMUNERACIONES, F29],
    projected_cash_14d: "10500",
    projected_cash_currency: "USD",
    covers_critical: null,
    data_state: "partial",
    confidence: "medium",
    missing_sources: ["Vencimientos de documentos (XML del DTE, pendiente)", "Tipo de cambio USD"],
    ...over,
  });
}

/** El registro sin nada agendado (SII sin conectar): la pantalla dice qué falta. */
export function pagosVacio(over: Partial<AccountsPayableResponse> = {}): AccountsPayableResponse {
  const base = pagos();
  return pagos({
    total: "0",
    total_by_currency: undefined,
    due_7d: "0",
    due_14d: "0",
    due_30d: "0",
    items: [],
    items_total: 0,
    overdue_summary: aggregate("0", 0),
    non_postponable_or_overdue_14d: aggregate("0", 0),
    filter_metadata: {
      ...base.filter_metadata,
      unfiltered_items_total: 0,
      matched_items_total: 0,
      by_category: base.filter_metadata.by_category.map((facet) => ({ ...facet, count: 0 })),
      by_criticality: base.filter_metadata.by_criticality.map((facet) => ({ ...facet, count: 0 })),
      by_state: base.filter_metadata.by_state.map((facet) => ({ ...facet, count: 0 })),
    },
    next_payroll: null,
    projected_cash_14d: null,
    cash_projection_publicable_14d: false,
    min_14d: null,
    cash_gap_amount_14d: null,
    has_gap: null,
    covers_critical: null,
    data_state: "partial",
    confidence: "low",
    missing_sources: ["Conectar SII"],
    ...over,
  });
}
