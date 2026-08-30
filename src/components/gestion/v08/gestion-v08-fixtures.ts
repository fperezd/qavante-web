/* Fixtures de V08 · Gestión — datos deterministas para stories y tests.
 *
 * Los montos del pivote son los del HTML de referencia (`qavante-ui.html`, bloques 08 y 08·B/C),
 * pero CUADRADOS entre sí: las subcategorías suman su sección, las secciones suman el resultado y
 * el drill-down suma la cuenta que lo abre. Un fixture que no cuadra deja pasar exactamente el bug
 * que los tests de esta vista vienen a atrapar (una fila expandible que suma distinto que su total).
 *
 * La serie de la Tendencia NO reusa los montos del pivote a propósito: los porcentajes que muestra
 * el HTML en 08·B (−32 % … 42 %) no reconcilian con su propio pivote —es una maqueta—, así que acá
 * se construye una serie propia donde el margen de cada mes SÍ sale de dividir su resultado por su
 * ingreso. */

import type {
  OperationalResultAlDia,
  OperationalResultBreakdown,
  OperationalResultDocuments,
  OperationalResultResponse,
} from "@/lib/api/gestion";
import type { CashCycleResponse } from "@/lib/api/treasury";
import type { DashboardSummaryResponse } from "@/lib/api/dashboard";
import type { DocConVencimiento } from "@/components/terminos/terminos-pago";

/** Referencia de "hoy": 23 de agosto de 2026, el mismo día del comparativo del HTML. */
export const HOY = new Date("2026-08-23T12:00:00-04:00");

export const PERIODO_ACTUAL = "2026-07";
export const MESES_PIVOTE = ["2026-05", "2026-06", "2026-07"];

/* ────────────────────────── dashboard/summary (la fuente de la Ley 1) ────────────────────────── */

/** Sólo el campo que V08 lee de verdad; el resto del summary no participa de esta vista.
 *  `as unknown as` porque el schema completo trae ~30 campos que este fixture no necesita
 *  inventar — y que la vista no toca. */
function summaryCon(result: string): DashboardSummaryResponse {
  return {
    operational_result: {
      revenue: "39945158",
      gross_margin: "32430984",
      ebitda_proxy: "16779336",
      result,
      last_updated: "2026-08-23T09:00:00Z",
      source: "operational_result_service",
    },
  } as unknown as DashboardSummaryResponse;
}

/** El caso sano: V01 y el pivote publican EL MISMO número. */
export const summary = () => summaryCon("16779336");

/** Los dos motores difieren en $336 — la pantalla tiene que decirlo, no elegir uno. */
export const summaryDivergente = () => summaryCon("16779000");

/** El summary no trajo el resultado: la Ley 1 no se puede chequear y el titular no se inventa. */
export const summarySinResultado = () => ({}) as unknown as DashboardSummaryResponse;

/* ────────────────────────── breakdown de 3 meses (el pivote) ────────────────────────── */

interface FilaFix {
  kind: string;
  key: string;
  label: string;
  by_month: string[];
  origen_counts?: Record<string, number>;
  children?: FilaFix[];
}

const INGRESOS: FilaFix = {
  kind: "section",
  key: "income",
  label: "Ingresos",
  by_month: ["30958134", "28267191", "39945158"],
  children: [
    {
      kind: "account",
      key: "operating_income.service_monthly",
      label: "Servicio mensual",
      by_month: ["15352888", "6853953", "14616879"],
      origen_counts: { rule: 8 },
    },
    {
      kind: "account",
      key: "operating_income.projects",
      label: "Proyectos",
      by_month: ["15605246", "21413238", "25328279"],
      origen_counts: { rule: 12 },
    },
  ],
};

const COSTOS: FilaFix = {
  kind: "section",
  key: "operating_expense",
  label: "Costos y gastos",
  by_month: ["-8825658", "-9469080", "-23165822"],
  children: [
    {
      kind: "account",
      key: "operating_expense.payroll_admin",
      label: "Remuneraciones administración",
      by_month: ["-5000000", "-5200000", "-11968052"],
      origen_counts: { payroll: 14 },
    },
    {
      kind: "account",
      key: "direct_cost.labor",
      label: "Mano de obra directa",
      by_month: ["-2000000", "-2300000", "-7514174"],
      origen_counts: { payroll: 9 },
    },
    {
      kind: "account",
      key: "operating_expense.legal_accounting",
      label: "Gastos legales y contables",
      by_month: ["-800000", "-850000", "-1065971"],
      origen_counts: { rule: 3 },
    },
    {
      kind: "account",
      key: "operating_expense.rent",
      label: "Arriendos",
      by_month: ["-500000", "-550000", "-927429"],
      origen_counts: { rule: 2 },
    },
    {
      kind: "account",
      key: "operating_expense.professional_fees",
      label: "Honorarios",
      by_month: ["-300000", "-320000", "-674661"],
      origen_counts: { bhe: 4 },
    },
    {
      kind: "account",
      key: "operating_expense.software_technology",
      label: "Software y tecnología",
      by_month: ["-200000", "-210000", "-656013"],
      origen_counts: { rule: 6 },
    },
    {
      kind: "account",
      key: "operating_expense.utilities",
      label: "Servicios básicos",
      by_month: ["-25658", "-39080", "-156229"],
      origen_counts: { giro: 2 },
    },
    {
      kind: "account",
      key: "unclassified",
      label: "Otros sin clasificar",
      by_month: ["0", "0", "-203293"],
      origen_counts: { unclassified: 3 },
    },
  ],
};

const RESULTADO: FilaFix = {
  kind: "subtotal",
  key: "result",
  label: "Resultado operacional",
  by_month: ["22132476", "18798111", "16779336"],
};

function totalDe(f: FilaFix): string {
  return String(f.by_month.reduce((s, v) => s + Number(v), 0));
}

function armar(f: FilaFix): Record<string, unknown> {
  return {
    kind: f.kind,
    key: f.key,
    label: f.label,
    by_month: f.by_month,
    total: totalDe(f),
    ...(f.origen_counts ? { origen_counts: f.origen_counts } : {}),
    ...(f.children ? { children: f.children.map(armar) } : {}),
  };
}

/** El pivote de tres meses. `2026-07` es el mes EN CURSO (proforma) — el mismo del summary. */
export function breakdown(): OperationalResultBreakdown {
  return {
    generated_at: "2026-08-23T12:00:00Z",
    period_from: "2026-05",
    period_to: "2026-07",
    mode: "por_cuenta",
    months: [...MESES_PIVOTE],
    proforma_month: PERIODO_ACTUAL,
    rows: [INGRESOS, COSTOS, RESULTADO].map(armar),
    warnings: [],
  } as unknown as OperationalResultBreakdown;
}

/** El pivote con UN solo mes — el caso N=1 de la concordancia de la caption ("1 mes", nunca "1
 *  meses"). El cableado real (`gestion-v08-live.tsx`) siempre pide 3 meses fijos para este pivote,
 *  así que este fixture no reproduce un escenario de producción; existe sólo porque `Pivote` es
 *  genérico sobre `months: string[]` y el defecto de concordancia es el mismo sin importar cómo se
 *  llegue a N=1. Las celdas del cuerpo quedan desalineadas (3 valores de `by_month` contra 1 mes) —
 *  no importa para este test, que sólo mira la caption `sr-only`. */
export function breakdownUnMes(): OperationalResultBreakdown {
  const bd = breakdown() as unknown as Record<string, unknown>;
  return { ...bd, months: ["2026-07"] } as unknown as OperationalResultBreakdown;
}

/** El backend no publicó `origen_counts` en ninguna fila → no se sabe cuántas excepciones quedan
 *  fuera del cuadro. El footer NO puede decir "0". */
export function breakdownSinOrigenCounts(): OperationalResultBreakdown {
  const bd = breakdown() as unknown as { rows: Array<Record<string, unknown>> };
  const limpiar = (r: Record<string, unknown>): Record<string, unknown> => {
    const { origen_counts: _omitido, ...resto } = r;
    const hijos = resto["children"] as Array<Record<string, unknown>> | undefined;
    return hijos ? { ...resto, children: hijos.map(limpiar) } : resto;
  };
  return { ...bd, rows: bd.rows.map(limpiar) } as unknown as OperationalResultBreakdown;
}

/** El mismo breakdown, pero con UNA sola excepción en todo el árbol — el caso N=1 de la
 *  concordancia del footer ("no incluye 1 excepción", nunca "1 excepciones"). Sólo la fila
 *  `unclassified` de Costos y gastos aporta al conteo (las demás traen `rule`/`payroll`/`bhe`/
 *  `giro`, que `excepcionesFooter` no suma), así que basta con bajar SU `unclassified` de 3 a 1. */
export function breakdownUnaExcepcion(): OperationalResultBreakdown {
  const bd = breakdown() as unknown as { rows: Array<Record<string, unknown>> };
  const conUnaExcepcion = (r: Record<string, unknown>): Record<string, unknown> => {
    const hijos = r["children"] as Array<Record<string, unknown>> | undefined;
    if (r["key"] === "unclassified") {
      return { ...r, origen_counts: { unclassified: 1 } };
    }
    return hijos ? { ...r, children: hijos.map(conUnaExcepcion) } : r;
  };
  return { ...bd, rows: bd.rows.map(conUnaExcepcion) } as unknown as OperationalResultBreakdown;
}

/* ────────────────────────── breakdown de 6 meses (la tendencia) ────────────────────────── */

const SERIE_TENDENCIA: Array<{ mes: string; ingreso: number; resultado: number }> = [
  { mes: "2026-02", ingreso: 20000000, resultado: -6340000 }, // −31,7 %
  { mes: "2026-03", ingreso: 25000000, resultado: 8000000 }, // 32,0 %
  { mes: "2026-04", ingreso: 22000000, resultado: 2640000 }, // 12,0 %
  { mes: "2026-05", ingreso: 28000000, resultado: 10080000 }, // 36,0 %
  { mes: "2026-06", ingreso: 24000000, resultado: 4320000 }, // 18,0 %
  { mes: "2026-07", ingreso: 39945158, resultado: 16779336 }, // 42,0 %
];

function breakdownSerie(
  serie: typeof SERIE_TENDENCIA,
  proforma: string | null,
): OperationalResultBreakdown {
  const months = serie.map((p) => p.mes);
  const fila = (kind: string, key: string, label: string, vals: number[]) => ({
    kind,
    key,
    label,
    by_month: vals.map(String),
    total: String(vals.reduce((s, v) => s + v, 0)),
  });
  return {
    generated_at: "2026-08-23T12:00:00Z",
    period_from: months[0],
    period_to: months[months.length - 1],
    mode: "por_cuenta",
    months,
    proforma_month: proforma,
    rows: [
      fila(
        "section",
        "income",
        "Ingresos",
        serie.map((p) => p.ingreso),
      ),
      fila(
        "subtotal",
        "result",
        "Resultado operacional",
        serie.map((p) => p.resultado),
      ),
    ],
    warnings: [],
  } as unknown as OperationalResultBreakdown;
}

/** Seis meses CERRADOS: mejor jul (42 %), peor feb (−31,7 %), promedio 18,1 %. */
export const breakdownTendencia = () => breakdownSerie(SERIE_TENDENCIA, null);

/** Los mismos seis + agosto EN CURSO con un margen absurdo (medio mes): mejor/peor/promedio NO
 *  pueden moverse — un mes parcial no compite contra meses enteros. */
export const breakdownTendenciaConProforma = () =>
  breakdownSerie(
    [...SERIE_TENDENCIA, { mes: "2026-08", ingreso: 1000000, resultado: 900000 }],
    "2026-08",
  );

/* ────────────────────────── operational-result del mes (Márgenes) ────────────────────────── */

export function mes(): OperationalResultResponse {
  return {
    period: PERIODO_ACTUAL,
    revenue: "39945158",
    direct_cost: "7514174",
    gross_margin: "32430984",
    gross_margin_pct: "81.2",
    labor_cost: "11968052",
    ebitda_proxy: "16779336",
    result: "16779336",
    unclassified: "203293",
  } as unknown as OperationalResultResponse;
}

/* ────────────────────────── al-día (el comparativo) ────────────────────────── */

/** Agosto al día 23 contra julio AL MISMO DÍA 23. */
export function alDia(): OperationalResultAlDia {
  return {
    period: "2026-08",
    hasta_dia: 23,
    actual: { revenue: "34932877", gross_margin: "27389765", result: "15172641" },
    mes_anterior: {
      period: "2026-07",
      revenue: "31240115",
      gross_margin: "25113902",
      result: "13014227",
    },
    variacion: {},
  } as unknown as OperationalResultAlDia;
}

/** Julio COMPLETO, del MISMO endpoint (`hasta_dia = 31`) → misma definición que las otras dos
 *  columnas. Es sólo referencia gris: jamás la base del delta. */
export function alDiaPrevioCompleto(): OperationalResultAlDia {
  return {
    period: "2026-07",
    hasta_dia: 31,
    actual: { revenue: "39945158", gross_margin: "32430984", result: "16779336" },
    mes_anterior: { period: "2026-06", revenue: "28267191", gross_margin: "0", result: "18798111" },
    variacion: {},
  } as unknown as OperationalResultAlDia;
}

/* ────────────────────────── ciclo de caja ────────────────────────── */

/** DSO sí, DPO no: el "no sé" del HTML 08·D, tal cual. */
export function ciclo(): CashCycleResponse {
  return {
    dso_days: 53,
    dpo_days: null,
    ccc_days: null,
    ar_total: "48000000",
    ap_total: "0",
    ar_ceded: "0",
    ceded_pct_of_ar: "0",
    cesiones_sin_marcar: 0,
    revenue_window: "39945158",
    revenue_ceded_window: "0",
    cogs_window: "7514174",
  } as unknown as CashCycleResponse;
}

/** El mismo ciclo, pero cobrando en UN solo día — el caso N=1 de la concordancia del banner
 *  ("Cobras en 1 día.", nunca "Cobras en 1 días."). */
export function cicloUnDia(): CashCycleResponse {
  return { ...ciclo(), dso_days: 1 } as unknown as CashCycleResponse;
}

/* ────────────────────────── drill-down monto → documentos ────────────────────────── */

/** Los documentos de "Servicio mensual" en julio. Suman EXACTAMENTE el monto de la celda
 *  ($14.616.879): una fila expandida que suma distinto que su total rompe el cuadro entero. */
export function documentosServicioMensual(): OperationalResultDocuments {
  return {
    account_code: "operating_income.service_monthly",
    account_name: "Servicio mensual",
    period: "2026-07",
    total: "14616879",
    count: 3,
    documents: [
      {
        side: "ventas",
        source_external_id: "33-435-76543210",
        document_ref: "FAC 435",
        counterparty: "Comercial Kaufmann S.A.",
        rut: "76.543.210-K",
        net_amount: "8408839",
        origen: "rule",
      },
      {
        side: "ventas",
        source_external_id: "33-434-77111222",
        document_ref: "FAC 434",
        counterparty: "Tepille SpA",
        rut: "77.111.222-3",
        net_amount: "4628591",
        origen: "rule",
      },
      {
        side: "ventas",
        source_external_id: "33-436-77999888",
        document_ref: "FAC 436",
        counterparty: "Ingeniería Andes Ltda.",
        rut: "77.999.888-1",
        net_amount: "1579449",
        origen: "memo",
      },
    ],
  } as unknown as OperationalResultDocuments;
}

/** El mismo drill-down, pero la lista NO suma el total declarado (falta $1.579.449). La vista lo
 *  tiene que DECIR: el usuario está mirando una lista incompleta bajo un total completo. */
export function documentosDescuadrados(): OperationalResultDocuments {
  const d = documentosServicioMensual();
  return { ...d, count: 2, documents: d.documents.slice(0, 2) };
}

/** El mismo descuadre, pero con UN solo documento listado — el caso N=1 de la concordancia
 *  ("El documento listado suma", nunca "Los 1 documentos"). */
export function documentosDescuadradosUno(): OperationalResultDocuments {
  const d = documentosServicioMensual();
  return { ...d, count: 1, documents: d.documents.slice(0, 1) };
}

/** UN solo documento que SÍ cuadra con el total de su celda — el caso N=1 de la concordancia de
 *  la rama sana ("1 documento · suma", nunca "1 documentos · suman"). El total baja a exactamente
 *  el monto de FAC 435 para que `resolverDrill` NO marque descuadre. */
export function documentosUnoCuadrado(): OperationalResultDocuments {
  const d = documentosServicioMensual();
  const unico = d.documents.slice(0, 1);
  return { ...d, total: unico[0]!.net_amount, count: 1, documents: unico };
}

/* ────────────────────────── maestro RCV (los 360) ────────────────────────── */

const SYNNEX = { rut: "77.915.170-0", name: "TD Synnex Chile Limitada" };

/** Compras de doce meses con TRES proveedores. TD Synnex neta $7.145.761 sobre un total de
 *  $13.145.761 → 54,4 % de concentración, por encima del umbral de alerta (30 %). */
export function docsCompras(): DocConVencimiento[] {
  return [
    {
      ...SYNNEX,
      fecha: "13/07/2026",
      monto: 1714965,
      folio: 3259,
      tipoDoc: 61,
    },
    {
      ...SYNNEX,
      fecha: "23/06/2026",
      monto: 12770345,
      folio: 3243,
      tipoDoc: 61,
    },
    {
      ...SYNNEX,
      fecha: "14/05/2026",
      monto: 12770345,
      folio: 26786,
      tipoDoc: 33,
    },
    {
      ...SYNNEX,
      fecha: "27/04/2026",
      monto: 8860726,
      folio: 26519,
      tipoDoc: 33,
    },
    {
      rut: "76.222.333-4",
      name: "Servicios Andes SpA",
      fecha: "10/06/2026",
      monto: 5000000,
      folio: 8812,
      tipoDoc: 33,
    },
    {
      rut: "76.444.555-6",
      name: "Papelería Central Ltda.",
      fecha: "05/05/2026",
      monto: 1000000,
      folio: 991,
      tipoDoc: 33,
    },
  ];
}

/** UN solo proveedor en 12 meses — la condición exacta que expuso "Los 1 proveedores" (PR #93): un
 *  buscador sin resultados sobre una cartera de un solo elemento. */
export function docsUnProveedor(): DocConVencimiento[] {
  return [
    {
      rut: "77.915.170-0",
      name: "TD Synnex Chile Limitada",
      fecha: "13/07/2026",
      monto: 1714965,
      folio: 3259,
      tipoDoc: 61,
    },
  ];
}

/** El mismo caso, lado ventas: un solo cliente en 12 meses. */
export function docsUnCliente(): DocConVencimiento[] {
  return [
    {
      rut: "76.100.100-1",
      name: "Cliente Uno SpA",
      fecha: "10/07/2026",
      monto: 5000000,
      folio: 1,
      tipoDoc: 33,
    },
  ];
}

/** Cuatro clientes parejos: NINGUNO pasa el umbral → no hay alerta de dependencia. */
export function docsVentasRepartidas(): DocConVencimiento[] {
  return [
    {
      rut: "76.100.100-1",
      name: "Cliente Uno SpA",
      fecha: "10/07/2026",
      monto: 5000000,
      folio: 1,
      tipoDoc: 33,
    },
    {
      rut: "76.200.200-2",
      name: "Cliente Dos SpA",
      fecha: "11/07/2026",
      monto: 5000000,
      folio: 2,
      tipoDoc: 33,
    },
    {
      rut: "76.300.300-3",
      name: "Cliente Tres SpA",
      fecha: "12/06/2026",
      monto: 5000000,
      folio: 3,
      tipoDoc: 33,
    },
    {
      rut: "76.400.400-4",
      name: "Cliente Cuatro SpA",
      fecha: "13/06/2026",
      monto: 5000000,
      folio: 4,
      tipoDoc: 33,
    },
  ];
}
