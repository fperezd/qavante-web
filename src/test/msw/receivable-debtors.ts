import { http, HttpResponse } from "msw";
import type { components } from "@/lib/api/types";

type DebtorsResponse = components["schemas"]["ReceivableDebtorsResponse"];
type Debtor = components["schemas"]["ReceivableDebtor"];
type CurrencyTotal = components["schemas"]["ReceivableDebtorCurrencyTotal"];

/* ── Directorio de deudores: SIETE deudores, y el séptimo es el que probaba el defecto ───────
 *
 * El fixture tiene siete a propósito (criterio de aceptación de #207). Cinco caben en el top, y
 * VOLCAN queda SEXTO por saldo con $13.300, que es la cifra exacta del issue: fuera del top 5,
 * que es la única cosa que el defecto hacía inalcanzable. El séptimo es Pesquera Chiloé, cuyo
 * importe está en cuarentena de conciliación: ordena al final porque su saldo es DESCONOCIDO,
 * no porque sea cero (ver `SALDO_DESCONOCIDO`).
 *
 * POR QUÉ IMPORTA QUE SEAN SIETE Y NO SEIS: con seis, un `pageSize` de 50 sobre la lista
 * completa y un top de 5 se comportan igual que el servidor para cualquier consulta, así que un
 * fixture de seis NO distingue la búsqueda local de la del servidor. El issue ya traía esa nota
 * ("fixtures de seis top_debtors no representan backend real"). Con siete y una página de 2 se
 * distinguen: buscar "VOLCAN" sólo lo encuentra si la consulta viajó al servidor, y el conteo
 * sólo dice 7 si salió de `items_total` en vez de las filas cargadas.
 *
 * Este handler resuelve de verdad `search`, `state`, `sort`, `limit` y `cursor`, porque si los
 * ignorara el test pasaría con una pantalla que tampoco los manda. El cursor es el índice de
 * la fila siguiente, en texto. */

const COMPANY = "a58a2ea8-0000-4000-8000-000000000001";

function clp(
  total: string | null,
  overdue: string | null,
  documentCount: number,
  extra: Partial<CurrencyTotal> = {},
): CurrencyTotal {
  return {
    currency: "CLP",
    currency_status: "known",
    document_count: documentCount,
    overdue,
    total,
    undated_amount: null,
    undated_document_count: 0,
    ...extra,
  };
}

/** Orden natural del fixture: por saldo CLP descendente. VOLCAN, último. */
const DEUDORES_BASE: Debtor[] = [
  {
    counterparty_key: "11111111-1111-4111-8111-000000000001",
    identity_resolution: "graph",
    name: "Constructora Andes SpA",
    tax_id: "76.123.456-7",
    receivable_ids: ["aaaa1111-1111-4111-8111-000000000001"],
    totals: [clp("9800000", "3200000", 4)],
  },
  {
    counterparty_key: "11111111-1111-4111-8111-000000000002",
    identity_resolution: "graph",
    name: "Comercial del Sur Ltda",
    tax_id: "77.987.654-3",
    receivable_ids: ["aaaa1111-1111-4111-8111-000000000002"],
    totals: [clp("6100000", "2400000", 3)],
  },
  {
    counterparty_key: "11111111-1111-4111-8111-000000000003",
    identity_resolution: "graph",
    name: "Minera Atacama SA",
    tax_id: "96.555.444-2",
    receivable_ids: ["aaaa1111-1111-4111-8111-000000000003"],
    // Dos monedas: la fila las muestra separadas y NADIE las suma.
    totals: [
      clp("4300000", "1100000", 2),
      {
        currency: "USD",
        currency_status: "known",
        document_count: 1,
        overdue: "0",
        total: "12500.40",
        undated_amount: null,
        undated_document_count: 0,
      },
    ],
  },
  {
    counterparty_key: "11111111-1111-4111-8111-000000000004",
    identity_resolution: "graph",
    name: "Transportes Biobío Ltda",
    tax_id: "78.222.333-4",
    receivable_ids: ["aaaa1111-1111-4111-8111-000000000004"],
    totals: [clp("2750000", null, 2, { undated_amount: "2750000", undated_document_count: 2 })],
  },
  {
    counterparty_key: "11111111-1111-4111-8111-000000000005",
    identity_resolution: "legacy_fallback",
    name: "Servicios Austral EIRL",
    tax_id: null,
    receivable_ids: ["aaaa1111-1111-4111-8111-000000000005"],
    totals: [clp("1400000", "140000", 1)],
  },
  {
    counterparty_key: "11111111-1111-4111-8111-000000000006",
    identity_resolution: "graph",
    name: "Pesquera Chiloé SA",
    tax_id: "79.444.555-6",
    receivable_ids: ["aaaa1111-1111-4111-8111-000000000006"],
    // Importe en cuarentena de conciliación: va `null` + motivo, nunca "$0".
    totals: [clp(null, null, 1, { amount_unknown_reason: "reconciliation_quarantine" })],
  },
  {
    counterparty_key: "11111111-1111-4111-8111-000000000007",
    identity_resolution: "graph",
    name: "VOLCAN Comercializadora SpA",
    tax_id: "80.111.222-3",
    receivable_ids: ["aaaa1111-1111-4111-8111-000000000007"],
    totals: [clp("13300", "13300", 1)],
  },
];

/** Notas de crédito y cedidas viven en su propio `state`: no se mezclan con el cobrable. */
const CREDITOS_BASE: Debtor[] = [
  {
    counterparty_key: "22222222-2222-4222-8222-000000000001",
    identity_resolution: "graph",
    name: "Comercial del Sur Ltda",
    tax_id: "77.987.654-3",
    receivable_ids: ["bbbb2222-2222-4222-8222-000000000001"],
    totals: [clp("-480000", null, 1)],
  },
];

const CEDIDAS_BASE: Debtor[] = [
  {
    counterparty_key: "33333333-3333-4333-8333-000000000001",
    identity_resolution: "graph",
    name: "Minera Atacama SA",
    tax_id: "96.555.444-2",
    receivable_ids: ["cccc3333-3333-4333-8333-000000000001"],
    totals: [clp("2200000", "0", 1)],
  },
];

/* INVARIANTE DEL FIXTURE: `receivable_ids` tiene que traer TANTOS ids como documentos declaran
   los totales. Un fixture donde esos dos números no cuadran es, él mismo, del tipo de mentira
   que este issue persigue: dejaría pasar una pantalla que cuenta documentos con el largo del
   arreglo en vez del `document_count` del servidor, sin que ningún test lo note. Se DERIVAN,
   así que no pueden divergir. */
function conIdsCoherentes(rows: Debtor[]): Debtor[] {
  return rows.map((row) => ({
    ...row,
    receivable_ids: Array.from(
      { length: row.totals.reduce((acc, t) => acc + t.document_count, 0) },
      (_, i) => `${row.counterparty_key}-doc-${i + 1}`,
    ),
  }));
}

const DEUDORES = conIdsCoherentes(DEUDORES_BASE);
const CREDITOS = conIdsCoherentes(CREDITOS_BASE);
const CEDIDAS = conIdsCoherentes(CEDIDAS_BASE);

function universo(state: string | null): Debtor[] {
  switch (state) {
    case "credit":
      return CREDITOS;
    case "ceded":
      return CEDIDAS;
    case "all":
      return [...DEUDORES, ...CREDITOS, ...CEDIDAS];
    default:
      return DEUDORES;
  }
}

/* Un saldo DESCONOCIDO (cuarentena de conciliación) no se ordena como cero: un `null` tratado
   como 0 lo mandaría al mismo lugar que un cliente que de verdad no debe nada, y encima lo
   haría en silencio. Acá va al final explícitamente, con `-1`, que no es un saldo posible. */
const SALDO_DESCONOCIDO = -1;

function saldoClp(debtor: Debtor): number {
  const clpTotal = debtor.totals.find((t) => t.currency === "CLP");
  if (clpTotal?.total == null) return SALDO_DESCONOCIDO;
  return Number(clpTotal.total);
}

function ordenar(rows: Debtor[], sort: string | null): Debtor[] {
  const out = [...rows];
  switch (sort) {
    case "name_asc":
      return out.sort((a, b) => a.name.localeCompare(b.name, "es-CL"));
    case "name_desc":
      return out.sort((a, b) => b.name.localeCompare(a.name, "es-CL"));
    case "document_count_desc":
      return out.sort((a, b) => b.receivable_ids.length - a.receivable_ids.length);
    default:
      return out.sort((a, b) => saldoClp(b) - saldoClp(a));
  }
}

/** El puente del ranking se calcula sobre el universo COMPLETO (sin paginar), que es justamente
 *  lo que la pantalla no podía hacer sola. */
function puente(rows: Debtor[]): components["schemas"]["ReceivableRankingBridge"][] {
  const conClp = rows.filter((r) => r.totals.some((t) => t.currency === "CLP" && t.total != null));
  const orden = [...conClp].sort((a, b) => saldoClp(b) - saldoClp(a));
  const suma = (list: Debtor[]) => list.reduce((acc, r) => acc + saldoClp(r), 0);
  const directorio = suma(orden);
  const top = suma(orden.slice(0, 5));
  return [
    {
      currency: "CLP",
      currency_status: "known",
      debtor_count: orden.length,
      directory_total: String(directorio),
      remainder_total: String(directorio - top),
      top_five_total: String(top),
      top_limit: 5,
    },
  ];
}

export const receivableDebtorsHandlers = [
  http.get("*/api/treasury/accounts-receivable/debtors", ({ request }) => {
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") ?? "").trim().toLocaleLowerCase("es-CL");
    const state = url.searchParams.get("state");
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const cursor = url.searchParams.get("cursor");

    /* Un cursor que no es un índice de este corte es exactamente el 422 del contrato
       ("cursor ajeno, alterado o incompatible con los filtros"), no una lista vacía. */
    const desde = cursor == null ? 0 : Number(cursor);
    if (!Number.isInteger(desde) || desde < 0) {
      return new HttpResponse(null, { status: 422 });
    }

    const filtrados = ordenar(universo(state), url.searchParams.get("sort")).filter(
      (debtor) =>
        !search ||
        `${debtor.name} ${debtor.tax_id ?? ""}`.toLocaleLowerCase("es-CL").includes(search),
    );
    const pagina = filtrados.slice(desde, desde + limit);
    const siguiente = desde + limit;
    const hasMore = siguiente < filtrados.length;

    const body: DebtorsResponse = {
      as_of: "2026-10-05T18:30:00-03:00",
      coverage: "complete",
      graph_contract_version: "d08.1",
      graph_fingerprint: "graph-fp-207",
      graph_version: 42,
      has_more: hasMore,
      identity_projection_fingerprint: "identity-fp-207",
      items: pagina,
      items_total: filtrados.length,
      net_bridge: [
        {
          ceded_excluded_total: "2200000",
          collectable_total: "24363300",
          credit_total: "-480000",
          currency: "CLP",
          currency_status: "known",
          gross_with_ceded_total: "26563300",
          net_collectable_total: "23883300",
        },
      ],
      next_cursor: hasMore ? String(siguiente) : null,
      portfolio_counts: {
        ceded_document_count: 1,
        collectable_document_count: 14,
        credit_note_document_count: 1,
        non_positive_document_count: 0,
        source_document_count: 16,
        unresolved_identity_document_count: 0,
      },
      portfolio_partitions: [
        { document_count: 14, state: "collectable", totals: [clp("24363300", "6853300", 14)] },
        { document_count: 1, state: "credit", totals: [clp("-480000", null, 1)] },
        { document_count: 1, state: "ceded", totals: [clp("2200000", "0", 1)] },
      ],
      ranking_bridge: puente(filtrados),
      receivables_fingerprint: "receivables-fp-207",
      references_fingerprint: "references-fp-207",
      references_versions: ["rcv:2026-10-05"],
      sentinel_registry_version: "sentinel-1",
      snapshot_fingerprint: "snapshot-fp-207",
      summary: {
        debtor_count: filtrados.length,
        document_count: filtrados.reduce((acc, r) => acc + r.receivable_ids.length, 0),
        totals: [clp("24363300", "6853300", 14)],
      },
    };
    return HttpResponse.json(body, { status: 200 });
  }),
];

export const receivableDebtorsFixture = {
  COMPANY,
  DEUDORES,
  CREDITOS,
  CEDIDAS,
};
