/* Fixtures compartidas por los tests y las stories de V04 · Cobrar. Sólo datos: nada se formatea
 * acá (el lint del rediseño §5.8 corre sobre este archivo). Las cifras son inventadas con la forma
 * del contrato vivo (`src/lib/api/types.ts`), no datos de un tenant. */

import type { AccountsReceivableResponse } from "@/lib/api/cobranza";
import { rutKey } from "../cobranza-format";
import type { GestionadoMap } from "../v2/cobrar-v2-map";

export const HOY = new Date("2026-08-30T12:00:00Z");

export const RUT_GPS = "77.444.444-4";
export const RUT_DIVEIMPORT = "76.111.111-1";
export const RUT_KAUFMANN = "76.222.222-2";
export const RUT_CORREOS = "76.333.333-3";
export const RUT_TEPILLE = "77.555.555-5";
export const RUT_ANDINOS = "77.666.666-6";

/* UUIDs de servidor inventados: las stories prueban que el front transmite identidad trazable,
 * nunca que reconstruye un cobrable desde la glosa o el RUT. */
const ID_DIVE = "00000000-0000-4000-8000-000000000001";
const ID_KAUFMANN = "00000000-0000-4000-8000-000000000002";
const ID_CORREOS = "00000000-0000-4000-8000-000000000003";
const ID_GPS_1 = "00000000-0000-4000-8000-000000000004";
const ID_GPS_2 = "00000000-0000-4000-8000-000000000005";
const ID_TEPILLE = "00000000-0000-4000-8000-000000000006";
const ID_ANDINOS = "00000000-0000-4000-8000-000000000007";

/** Caso NORMAL: vencido conocido, un cliente por sobre los 60 días (GPS7000, 80 días), otro
 *  también grave pero menos (Diveimport, 73 días), dos entre 1 y 60, uno al día y uno cuyo vencido
 *  el registro no pudo computar. Los tramos de mora suman EXACTAMENTE `overdue` (contrato). La suma
 *  de los saldos del top NO es el total: el top es un top, no la cartera. */
export function ar(over: Partial<AccountsReceivableResponse> = {}): AccountsReceivableResponse {
  return {
    total: "42579467",
    overdue: "27779467",
    overdue_pct: "65.2",
    undated_amount: "0",
    estimated_due_date_count: 0,
    document_count: 15,
    aging: {
      current: "14800000",
      d1_30: "9400000",
      d31_60: "8900000",
      d61_90: "5400000",
      d90_plus: "4079467",
    },
    top_debtors: [
      {
        name: "Diveimport S.A.",
        rut: RUT_DIVEIMPORT,
        total: "11582539",
        overdue: "3300000",
        receivable_ids: [ID_DIVE],
      },
      {
        name: "Comercial Kaufmann S.A.",
        rut: RUT_KAUFMANN,
        total: "4322373",
        overdue: "4322373",
        receivable_ids: [ID_KAUFMANN],
      },
      {
        name: "Empresa de Correos de Chile",
        rut: RUT_CORREOS,
        total: "4672594",
        overdue: "4672594",
        receivable_ids: [ID_CORREOS],
      },
      {
        name: "GPS7000",
        rut: RUT_GPS,
        total: "1792441",
        overdue: "1792441",
        receivable_ids: [ID_GPS_1, ID_GPS_2],
      },
      {
        name: "Tepille SpA",
        rut: RUT_TEPILLE,
        total: "1050041",
        overdue: "0",
        receivable_ids: [ID_TEPILLE],
      },
      {
        name: "Servicios Andinos Ltda",
        rut: RUT_ANDINOS,
        total: "980000",
        overdue: null,
        receivable_ids: [ID_ANDINOS],
      },
    ],
    overdue_documents: [
      {
        id: ID_DIVE,
        client_name: "Diveimport S.A.",
        client_rut: RUT_DIVEIMPORT,
        document: "Factura 450",
        due_date: "2026-06-18",
        due_date_certainty: "confirmed" as const,
        amount: "3300000",
        balance: "3300000",
        days_overdue: 73,
      },
      {
        id: ID_KAUFMANN,
        client_name: "Comercial Kaufmann S.A.",
        client_rut: RUT_KAUFMANN,
        document: "Factura 501",
        due_date: "2026-07-27",
        due_date_certainty: "confirmed" as const,
        amount: "4322373",
        balance: "4322373",
        days_overdue: 34,
      },
      {
        id: ID_CORREOS,
        client_name: "Empresa de Correos de Chile",
        client_rut: RUT_CORREOS,
        document: "Factura 490",
        due_date: "2026-08-09",
        due_date_certainty: "confirmed" as const,
        amount: "4672594",
        balance: "4672594",
        days_overdue: 21,
      },
      /* El MENOS vencido va primero a propósito: si la fila tomara "el primer documento listado"
         en vez del máximo, mostraría 12 días donde corresponden 80, y los tests lo cazan. */
      {
        id: ID_GPS_1,
        client_name: "GPS7000",
        client_rut: RUT_GPS,
        document: "Factura 401",
        due_date: "2026-08-18",
        due_date_certainty: "confirmed" as const,
        amount: "792441",
        balance: "792441",
        days_overdue: 12,
      },
      {
        id: ID_GPS_2,
        client_name: "GPS7000",
        client_rut: RUT_GPS,
        document: "Factura 388",
        due_date: "2026-06-11",
        due_date_certainty: "confirmed" as const,
        amount: "1000000",
        balance: "1000000",
        days_overdue: 80,
      },
    ],
    confidence: "high",
    data_state: "available",
    missing_sources: [],
    generated_at: "2026-08-30T08:12:00Z",
    ...over,
  };
}

/** El caso VIVO de producción (2026-08-30, tenant principal): el SII no entrega vencimientos, el
 *  registro publica `overdue: null`, los tramos de mora en `null`, `undated_amount == total` y el
 *  vencido de CADA deudor en `null`. Ni un solo "$0" es honesto acá. */
export function arVencidoDesconocido(
  over: Partial<AccountsReceivableResponse> = {},
): AccountsReceivableResponse {
  return ar({
    overdue: null,
    overdue_pct: null,
    undated_amount: "42579467",
    estimated_due_date_count: 0,
    aging: { current: "0", d1_30: null, d31_60: null, d61_90: null, d90_plus: null },
    top_debtors: [
      { name: "Diveimport S.A.", rut: RUT_DIVEIMPORT, total: "11582539", overdue: null },
      { name: "Comercial Kaufmann S.A.", rut: RUT_KAUFMANN, total: "4322373", overdue: null },
      { name: "Empresa de Correos de Chile", rut: RUT_CORREOS, total: "4672594", overdue: null },
      { name: "GPS7000", rut: RUT_GPS, total: "1792441", overdue: null },
      { name: "Tepille SpA", rut: RUT_TEPILLE, total: "1050041", overdue: null },
    ],
    overdue_documents: [],
    confidence: "medium",
    data_state: "partial",
    missing_sources: ["Vencimientos de documentos (XML del DTE, pendiente)"],
    ...over,
  });
}

/** Sin cartera cargada: el registro no tiene documentos vivos y dice por qué. */
export function arSinClientes(
  over: Partial<AccountsReceivableResponse> = {},
): AccountsReceivableResponse {
  return ar({
    total: "0",
    overdue: null,
    overdue_pct: null,
    undated_amount: "0",
    estimated_due_date_count: 0,
    document_count: 0,
    aging: { current: "0", d1_30: null, d31_60: null, d61_90: null, d90_plus: null },
    top_debtors: [],
    overdue_documents: [],
    confidence: "low",
    data_state: "partial",
    missing_sources: ["Conectar SII"],
    ...over,
  });
}

/** Concentración ALTA: tres clientes cargan casi todo el vencido; un cuarto, chico, queda afuera
 *  del lote (y de la suma). */
export function arConcentracionAlta(
  over: Partial<AccountsReceivableResponse> = {},
): AccountsReceivableResponse {
  return ar({
    total: "30000000",
    overdue: "20000000",
    overdue_pct: "66.7",
    aging: {
      current: "10000000",
      d1_30: "2000000",
      d31_60: "6000000",
      d61_90: "7000000",
      d90_plus: "5000000",
    },
    top_debtors: [
      {
        name: "Diveimport S.A.",
        rut: RUT_DIVEIMPORT,
        total: "9000000",
        overdue: "9000000",
        receivable_ids: [ID_DIVE],
      },
      {
        name: "Comercial Kaufmann S.A.",
        rut: RUT_KAUFMANN,
        total: "6000000",
        overdue: "6000000",
        receivable_ids: [ID_KAUFMANN],
      },
      {
        name: "Empresa de Correos de Chile",
        rut: RUT_CORREOS,
        total: "4000000",
        overdue: "3500000",
        receivable_ids: [ID_CORREOS],
      },
      {
        name: "GPS7000",
        rut: RUT_GPS,
        total: "1500000",
        overdue: "1500000",
        receivable_ids: [ID_GPS_2],
      },
    ],
    overdue_documents: [
      {
        id: ID_DIVE,
        client_name: "Diveimport S.A.",
        client_rut: RUT_DIVEIMPORT,
        document: "Factura 450",
        due_date: "2026-05-01",
        due_date_certainty: "confirmed" as const,
        amount: "9000000",
        balance: "9000000",
        days_overdue: 121,
      },
      {
        id: ID_KAUFMANN,
        client_name: "Comercial Kaufmann S.A.",
        client_rut: RUT_KAUFMANN,
        document: "Factura 501",
        due_date: "2026-07-27",
        due_date_certainty: "confirmed" as const,
        amount: "6000000",
        balance: "6000000",
        days_overdue: 34,
      },
      {
        id: ID_CORREOS,
        client_name: "Empresa de Correos de Chile",
        client_rut: RUT_CORREOS,
        document: "Factura 490",
        due_date: "2026-06-25",
        due_date_certainty: "confirmed" as const,
        amount: "3500000",
        balance: "3500000",
        days_overdue: 66,
      },
      {
        id: ID_GPS_2,
        client_name: "GPS7000",
        client_rut: RUT_GPS,
        document: "Factura 388",
        due_date: "2026-08-20",
        due_date_certainty: "confirmed" as const,
        amount: "1500000",
        balance: "1500000",
        days_overdue: 10,
      },
    ],
    ...over,
  });
}

/** Todo al día: cero VERIFICADO. Acá "$0" y "0%" son la verdad y tienen que verse. */
export function arTodoAlDia(
  over: Partial<AccountsReceivableResponse> = {},
): AccountsReceivableResponse {
  return ar({
    total: "12000000",
    overdue: "0",
    overdue_pct: "0",
    aging: { current: "12000000", d1_30: "0", d31_60: "0", d61_90: "0", d90_plus: "0" },
    top_debtors: [
      { name: "Diveimport S.A.", rut: RUT_DIVEIMPORT, total: "7000000", overdue: "0" },
      { name: "Tepille SpA", rut: RUT_TEPILLE, total: "5000000", overdue: "0" },
    ],
    overdue_documents: [],
    document_count: 4,
    ...over,
  });
}

/** Gestiones registradas (prefs `cobranza_gestionado`, Cobrar v2): rut normalizado → ISO. */
export function gestionado(over: GestionadoMap = {}): GestionadoMap {
  return {
    [rutKey(RUT_DIVEIMPORT)]: "2026-08-28",
    [rutKey(RUT_KAUFMANN)]: "2026-08-21",
    ...over,
  };
}
