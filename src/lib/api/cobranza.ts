import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { ApiError } from "./errors";
import { explicitCompanyRequestHeaders } from "@/lib/company/active-company";
import type { components, paths } from "./types";

/* Capa de datos — Cobrar / Cuentas por cobrar (Sprint C4, Documento Maestro
   §7.3).

   `GET /api/treasury/accounts-receivable` YA existe en el backend (cookie-ready)
   y el flag `accountsReceivable` está ON en prod. Cuando el devengado
   (treasury.receivables, poblado por `sync-rcv`) está vacío, el backend devuelve
   honesto `data_state:"partial"` + `missing_sources` (ADR-0055 F1) en vez de un
   $0 confiado → la UI muestra "sincronización pendiente".

   Montos como string-decimal (igual que el resto del API treasury).

   ── POR QUÉ los tipos ahora DERIVAN del contrato (hallazgo H6) ────────────────
   Antes estas interfaces se declaraban A MANO. Consecuencia real: cuando el
   contrato cambió, `npm run generate:api` regeneró `types.ts` y acá no pasó
   NADA — ni un error de compilación. El cambio entró mudo y la pantalla siguió
   mostrando un dato viejo como si fuera bueno. Ejemplo vivo: el contrato dice
   `TopDebtor.rut?: string | null` ("null si falta") desde hace rato, y el tipo a
   mano decía `rut: string` a secas.

   Ahora todo sale de `components["schemas"][...]`: si el backend renombra o
   borra un campo, esto deja de compilar. */

type GenAccountsReceivable = components["schemas"]["AccountsReceivableResponse"];
type GenARAging = components["schemas"]["ARAging"];
type GenTopDebtor = components["schemas"]["TopDebtor"];
type GenOverdueDocument = components["schemas"]["OverdueDocument"];
type GenReceivableDocumentsResponse = components["schemas"]["ReceivableDocumentsResponse"];

/* ── La deuda controlada de #123 queda SALDADA ───────────────────────────
 *
 * Acá vivía un override a mano que volvía nullables `overdue`, `overdue_pct` y los
 * cuatro tramos de mora, porque `npm run generate:api` apunta al openapi de
 * PRODUCCIÓN y qavante-api#123 todavía no estaba deployado: regenerar habría
 * revertido el contrato nuevo.
 *
 * #123 y #124 **ya están en producción** (verificado el 2026-08-25 contra
 * `api.qavante.com`: `overdue: null`, `undated_amount` presente, y `overdue: null`
 * también en cada `top_debtors[]`). Se corrió `generate:api` y se borraron los
 * overrides, que es literalmente lo que este comentario pedía hacer.
 *
 * Y sirvió para lo que prometía: al borrarlos, `tsc` marcó **21 errores**, todos en
 * lugares donde el front trataba un "no se sabe" como si fuera un dato. El caso
 * más caro estaba en la tabla de deudores, que con `overdue: null` —o sea el 100%
 * de los deudores en producción hoy— simplemente **ocultaba** la línea de vencido:
 * el dueño veía una lista limpia, indistinguible de "todos al día". El override
 * cubría la respuesta agregada pero NO `TopDebtor`, así que ese camino nunca estuvo
 * tipado. */

/** Antigüedad de saldos (aging) — montos string-decimal CLP. Los cuatro tramos de
 *  MORA pueden venir `null` = "no se pudo computar"; `current` (vigente) nunca. */
export type ReceivableAging = GenARAging;

/** Extensión aditiva de API #314. El generador web aún apunta al OpenAPI desplegado, que puede
 * ir detrás del snapshot versionado de `qavante-api/main`; este alias mantiene el contrato estricto
 * en el único consumidor hasta la siguiente regeneración sin arrastrar miles de líneas ajenas. */
export type TopDebtor = GenTopDebtor & { receivable_ids?: string[] };

export type OverdueDocument = GenOverdueDocument & { id: string };

/** El response se vuelve a componer para propagar las extensiones aditivas a todos sus hijos. */
export type AccountsReceivableResponse = Omit<
  GenAccountsReceivable,
  "top_debtors" | "overdue_documents"
> & {
  top_debtors?: TopDebtor[];
  overdue_documents?: OverdueDocument[];
};
/** API #297, fijado contra el snapshot versionado. No se usa `bulk`: esa ruta nunca existió. */
export interface CollectionReminderBatchRequest {
  receivable_ids: string[];
  idempotency_key: string;
}
export interface CollectionReminderItemResult {
  receivable_id: string;
  status: "sent" | "sin_destinatario" | "skipped" | "error";
  detail: string;
}
export interface CollectionReminderBatchResponse {
  items: CollectionReminderItemResult[];
}

/* Contrato aditivo de qavante-api#619. Se mantiene explícito hasta que el endpoint esté
 * desplegado y `generate:api` pueda consumirlo desde producción; el snapshot versionado vive en
 * el PR backend. Mismo puente acotado que `TopDebtor.receivable_ids` arriba. */
export interface ReceivableMoneyTotal {
  currency: string;
  /** `null` = desconocido por cuarentena de conciliación en esa moneda (qavante-api#907);
   *  nunca una suma parcial ni cero. */
  amount: string | null;
  amount_unknown_reason?: "reconciliation_quarantine" | null;
}
export interface ReceivableDocumentItem {
  id: string;
  folio: string;
  document_type?: number | null;
  customer_name: string;
  customer_rut?: string | null;
  counterparty_key?: string | null;
  issue_date: string;
  due_date?: string | null;
  due_date_certainty: "confirmed" | "estimated" | "unconfirmed";
  status: "open" | "partially_paid" | "paid" | "cancelled";
  /** `null` si el documento está en cuarentena de conciliación (qavante-api#907). */
  total_amount: string | null;
  /** `null` si el documento está en cuarentena de conciliación (qavante-api#907). */
  outstanding_amount: string | null;
  amount_unknown_reason?: "reconciliation_quarantine" | null;
  currency_code: string;
  days_overdue?: number | null;
  ceded?: boolean;
  claimed?: boolean;
  credit_note?: boolean;
}
/** La lista y su cobertura salen del snapshot OpenAPI. En particular, `collected: null`
 * es una abstención del backend: la UI no puede convertirla en un cero. */
export type ReceivableDocumentsResponse = GenReceivableDocumentsResponse;
export interface CollectionReminderRule {
  kind: "before_due" | "due_today" | "overdue";
  enabled: boolean;
  days_offset: number;
  schedule_time: string;
  audience_mode: "all" | "exclude" | "include";
  counterparty_keys?: string[];
  updated_at?: string | null;
}
export interface CollectionReminderRuleUpdate {
  enabled: boolean;
  days_offset: number;
  schedule_time: string;
  audience_mode: "all" | "exclude" | "include";
  counterparty_keys?: string[];
}
export interface CollectionReminderRulesResponse {
  items: CollectionReminderRule[];
}

export const cobranzaKeys = {
  all: ["cobranza"] as const,
  accountsReceivable: () => [...cobranzaKeys.all, "accounts-receivable"] as const,
  documents: (q: string) => [...cobranzaKeys.all, "documents", q] as const,
  reminderSettings: () => [...cobranzaKeys.all, "reminder-settings"] as const,
  /* La empresa activa va DENTRO de la clave. El scope de `/debtors` viaja en el header
     `X-Qavante-Company-Id`, invisible para React Query: sin la empresa en la clave, cambiar de
     sociedad servía el directorio de la anterior desde caché y la pantalla mostraba deudores
     que no son de esa empresa (el mismo hoyo que `accountsReceivable()` todavía tiene).

     Los filtros también van en la clave, así que cambiar uno ARRANCA OTRA consulta desde la
     primera página en vez de encadenar un cursor que el servidor emitió para otros filtros
     —eso último es un 422 por contrato— y la respuesta vieja que llegue tarde se descarta
     sola: ya no es la clave activa. */
  debtors: (companyId: string | null, params: ReceivableDebtorsParams) =>
    [...cobranzaKeys.all, "debtors", companyId, params] as const,
};

/** `GET /api/treasury/accounts-receivable` — snapshot actual de cuentas por
 *  cobrar. NO retry. */
export function useAccountsReceivable() {
  return useQuery({
    queryKey: cobranzaKeys.accountsReceivable(),
    queryFn: () => api.get<AccountsReceivableResponse>("/api/treasury/accounts-receivable"),
    staleTime: 30_000,
    retry: false,
  });
}

export function useReceivableDocuments(q = "") {
  const search = q.trim();
  return useQuery({
    queryKey: cobranzaKeys.documents(search),
    queryFn: () =>
      api.get<ReceivableDocumentsResponse>(
        `/api/treasury/accounts-receivable/documents?limit=100${search ? `&q=${encodeURIComponent(search)}` : ""}`,
      ),
    staleTime: 30_000,
    retry: false,
  });
}

export function useCollectionReminderSettings() {
  return useQuery({
    queryKey: cobranzaKeys.reminderSettings(),
    queryFn: () =>
      api.get<CollectionReminderRulesResponse>("/api/treasury/collection-reminders/settings"),
    staleTime: 30_000,
    retry: false,
  });
}

export function useUpdateCollectionReminderSetting() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      kind,
      input,
    }: {
      kind: CollectionReminderRule["kind"];
      input: CollectionReminderRuleUpdate;
    }) =>
      api.put<CollectionReminderRule>(`/api/treasury/collection-reminders/settings/${kind}`, {
        body: input,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: cobranzaKeys.reminderSettings() }),
  });
}

/** Envía sólo UUIDs recibidos desde `accounts-receivable`. Nunca reconstruye un documento desde
 * nombre, RUT, monto o fecha: una contraparte puede tener varios cobrables parecidos (#311). */
export function sendCollectionReminders(input: CollectionReminderBatchRequest) {
  return api.post<CollectionReminderBatchResponse>("/api/treasury/collection-reminders/send", {
    body: input,
  });
}

export function useSendCollectionReminders() {
  return useMutation({ mutationFn: sendCollectionReminders });
}

/* ── Directorio canónico de deudores ────────────────────────────────────────────────────────
 *
 * `GET /api/treasury/accounts-receivable/debtors` está en el contrato desde el 2026-09-16 y
 * hasta ahora tenía CERO consumidores: `accounts-receivable/debtors` aparecía una sola vez en
 * todo `src/`, dentro de `types.ts`. Mientras tanto la cartera se armaba desde
 * `top_debtors` —un top 5— y la pantalla buscaba y paginaba en memoria sobre esas cinco filas.
 * Un deudor fuera del top era inalcanzable POR CONSTRUCCIÓN, no por falta de datos.
 *
 * Lo que este endpoint hace y la lista topeada no podía hacer:
 *   · `search`, `state`, `due_state`, `document_status`, `currency`, `currency_status` y `sort`
 *     los resuelve el SERVIDOR sobre la cartera completa.
 *   · `items_total` = "deudores que cumplen los filtros, SIN paginar". Es el único conteo
 *     honesto: un `.length` sobre la página cargada dice cuántas filas se alcanzaron a traer,
 *     que no es cuántos deudores hay.
 *   · `ranking_bridge[]` publica, POR MONEDA, `top_five_total`, `directory_total`,
 *     `remainder_total` y `debtor_count`. O sea: el propio servidor dice cuánto es el top 5 y
 *     cuánto es el resto. No hay que estimarlo ni esconderlo.
 *   · `coverage` es siempre `"complete"`: si una CxC cobrable no se resuelve contra el grafo
 *     D08, la lectura FALLA CERRADA en vez de publicar un directorio parcial. Por eso un 409
 *     no es "no hay deudores": es "este corte ya no sirve, pide otro".
 *
 * NO retry (`retry: false`), como el resto de la capa: un 409 se resuelve recargando el corte,
 * no reintentando el mismo cursor.
 */
export type ReceivableDebtorsResponse = components["schemas"]["ReceivableDebtorsResponse"];
export type ReceivableDebtor = components["schemas"]["ReceivableDebtor"];
export type ReceivableDebtorCurrencyTotal = components["schemas"]["ReceivableDebtorCurrencyTotal"];
export type ReceivableRankingBridge = components["schemas"]["ReceivableRankingBridge"];
export type ReceivableDebtorsSummary = components["schemas"]["ReceivableDebtorsSummary"];

type DebtorsQuery = NonNullable<
  paths["/api/treasury/accounts-receivable/debtors"]["get"]["parameters"]["query"]
>;

/** Los filtros tal como los nombra el contrato. Nada de traducir acá: el nombre del parámetro
 *  es el del servidor, así que un renombre en el contrato deja de compilar. */
export interface ReceivableDebtorsParams {
  search?: string;
  state?: DebtorsQuery["state"];
  due_state?: DebtorsQuery["due_state"];
  document_status?: DebtorsQuery["document_status"];
  currency?: DebtorsQuery["currency"];
  currency_status?: DebtorsQuery["currency_status"];
  sort?: DebtorsQuery["sort"];
  /** Página del servidor. Default del contrato: 50; máximo 50 por esta vista. */
  limit?: number;
}

/** `limit` lo acota el contrato en 100. Esta vista pide 50 (el default del servidor) porque es
 *  una tabla que se lee, no un volcado. */
export const DEBTORS_PAGE_SIZE = 50;

export function receivableDebtorsPath(
  params: ReceivableDebtorsParams,
  cursor?: string | null,
): string {
  const query = new URLSearchParams();
  query.set("limit", String(params.limit ?? DEBTORS_PAGE_SIZE));
  // `search` se manda recortado y sólo si quedó algo: un " " no es un filtro.
  const search = params.search?.trim();
  if (search) query.set("search", search);
  if (params.state) query.set("state", params.state);
  if (params.due_state) query.set("due_state", params.due_state);
  if (params.document_status) query.set("document_status", params.document_status);
  if (params.currency) query.set("currency", params.currency);
  if (params.currency_status) query.set("currency_status", params.currency_status);
  if (params.sort) query.set("sort", params.sort);
  if (cursor) query.set("cursor", cursor);
  return `/api/treasury/accounts-receivable/debtors?${query.toString()}`;
}

/** 409 (el corte cambió o el grafo D08 perdió cobertura) y 422 (cursor ajeno o incompatible con
 *  los filtros) se tratan IGUAL en la pantalla: el corte que se estaba leyendo ya no sirve y hay
 *  que pedir uno nuevo desde la primera página. Son las dos únicas respuestas del contrato que
 *  significan "reinicia", y por eso se reconocen acá y no en cada vista. */
export function esCorteVencido(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 409 || error.status === 422);
}

export function useReceivableDebtors(
  companyId: string | null,
  params: ReceivableDebtorsParams = {},
) {
  return useInfiniteQuery({
    queryKey: cobranzaKeys.debtors(companyId, params),
    queryFn: ({ pageParam }) =>
      api.get<ReceivableDebtorsResponse>(receivableDebtorsPath(params, pageParam), {
        headers: explicitCompanyRequestHeaders(companyId),
      }),
    initialPageParam: null as string | null,
    /* `has_more` manda sobre `next_cursor`: el contrato publica los dos y un cursor presente
       con `has_more: false` no habilita otra página. */
    getNextPageParam: (last) => (last.has_more ? (last.next_cursor ?? null) : null) || undefined,
    enabled: Boolean(companyId),
    staleTime: 30_000,
    retry: false,
  });
}
