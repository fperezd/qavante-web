import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components, operations } from "./types";

/* D07 — evidencia de referencias entre DTE. El productor publica UNA sola lectura:
 * `GET /api/sii/document-links` (operación `sii_document_links`). No existe un endpoint de
 * resolución por lote: la pantalla pide las observaciones VIGENTES del lado documental que está
 * mirando y las indexa por el DTE corrector. Acá no se deriva ningún efecto: el contrato ya dice
 * si la evidencia autoriza el efecto (`monetary_effect.automatic_allowed`) y la vista sólo
 * traduce. Sin observación no se infiere "anulado": se dice que no hay evidencia. */

export type DteDocumentLink = components["schemas"]["DteDocumentLink"];
export type DteDocumentLinksResponse = components["schemas"]["DteDocumentLinksResponse"];
export type DocumentLinkKind = DteDocumentLink["document_kind"];
export type DocumentLinkStatus = DteDocumentLink["link_status"];

type DocumentLinksQuery = NonNullable<operations["sii_document_links"]["parameters"]["query"]>;

export const DOCUMENT_LINKS_PATH = "/api/sii/document-links";
/** Tope del contrato (`limit` máximo 1000). Un período RCV no supera ese orden de correctores. */
export const DOCUMENT_LINKS_LIMIT = 1000;

export const DOCUMENT_LINK_STATUS_LABELS: Record<DocumentLinkStatus, string> = {
  annulled_confirmed: "Anulación fiscal confirmada",
  amount_corrected: "Corrección de monto confirmada",
  text_corrected: "Corrección de texto confirmada",
  linked_effect_unknown: "Referencia observada; efecto no confirmado",
  possible_association: "Asociación posible",
  ambiguous: "Evidencia ambigua; requiere revisión",
  unresolved: "Sin asociación fiscal confirmada",
};

export const DOCUMENT_LINK_UNAVAILABLE_LABEL = "Estado no disponible";
export const DOCUMENT_LINK_NOT_OBSERVED_LABEL = "Sin evidencia registrada";

export type DocumentLinkResolution =
  /** El servidor publicó una observación vigente para este corrector. */
  | { availability: "available"; link: DteDocumentLink }
  /** La consulta respondió y este corrector no tiene observación vigente: no se infiere efecto. */
  | { availability: "not_observed" }
  /** La consulta no se pudo hacer o falló: la pantalla no sabe, y lo dice. */
  | { availability: "unavailable"; error?: unknown };

/** Índice por el identificador estable del DTE **corrector** (la fila que lleva el badge). */
export function indexDocumentLinks(
  response: DteDocumentLinksResponse | undefined,
): Map<string, DteDocumentLink> {
  const index = new Map<string, DteDocumentLink>();
  for (const link of response?.items ?? []) {
    /* `include_history` va en false, pero el índice no confía en el parámetro: una observación
       reemplazada nunca puede pisar a la vigente. */
    if (!link.is_current) continue;
    const key = link.correcting_source_external_id;
    if (typeof key === "string" && key.length > 0 && !index.has(key)) index.set(key, link);
  }
  return index;
}

/** Resuelve una fila: distingue "no hay evidencia" de "no pudimos consultar". */
export function resolveDocumentLink(
  index: ReadonlyMap<string, DteDocumentLink> | undefined,
  sourceExternalId: string | null | undefined,
  state: { failed?: boolean },
): DocumentLinkResolution | undefined {
  if (!sourceExternalId) return undefined;
  if (state.failed) return { availability: "unavailable" };
  if (!index) return undefined;
  const link = index.get(sourceExternalId);
  return link ? { availability: "available", link } : { availability: "not_observed" };
}

export const documentLinkKeys = {
  all: ["sii", "document-links"] as const,
  list: (kind: DocumentLinkKind) => [...documentLinkKeys.all, "list", kind] as const,
};

export function fetchDocumentLinks(
  kind: DocumentLinkKind,
  signal?: AbortSignal,
): Promise<DteDocumentLinksResponse> {
  const query: DocumentLinksQuery = { kind, include_history: false, limit: DOCUMENT_LINKS_LIMIT };
  const search = new URLSearchParams({
    kind: query.kind as string,
    include_history: String(query.include_history),
    limit: String(query.limit),
  });
  return api.get<DteDocumentLinksResponse>(`${DOCUMENT_LINKS_PATH}?${search.toString()}`, {
    signal,
  });
}

export function useDocumentLinks(kind: DocumentLinkKind, enabled = true) {
  return useQuery({
    queryKey: documentLinkKeys.list(kind),
    queryFn: ({ signal }) => fetchDocumentLinks(kind, signal),
    enabled,
    staleTime: 15_000,
    retry: false,
  });
}
