/* Fixtures compartidas por los tests y las stories de V07 · Bandeja de excepciones.
 *
 * Sólo datos: nada se formatea acá (el lint del rediseño §5.8 corre sobre este archivo). Las
 * cifras son inventadas con la FORMA del contrato vivo (`src/lib/api/types.ts`): `ReviewItem` sin
 * dirección (la cola no la trae), `DocumentSuggestion` con monto string-decimal absoluto y score
 * 0-100, `BankMovement` con `direction` explícita y `amount` en magnitud.
 *
 * Los dos casos de la Ley 3 están construidos a propósito y son el eje de los tests:
 *   · KAUFMANN — RUT y folio en la glosa, monto exacto ⇒ HAY sugerencia, y el why-strip tiene
 *     chips porque las verificaciones pasan de verdad.
 *   · VOLCÁN — el caso del HTML de referencia: pagador distinto del cliente, diferencia de
 *     $30.265 y fecha lejana ⇒ NO hay sugerencia y el why-strip queda VACÍO. */

import type {
  BankMovement,
  BankMovementsListResponse,
  CanonicalCategoryMeta,
} from "@/lib/api/treasury";
import type { DocumentSuggestionsResponse, ReviewQueueResponse } from "@/lib/api/reconciliation";
import type { SuggestedCategoryResponse } from "@/lib/api/classification-rules";
import type { OpcionCuentaV07, SugerenciaCategoriaV07 } from "./bandeja-v07-model";

export const HOY = new Date("2026-08-30T12:00:00Z");

export const RUT_KAUFMANN = "96572360-9";
export const RUT_VOLCAN = "81201000-K";
export const RUT_DATTATEC = "76888888-8";
export const RUT_ENTEL = "92580000-7";

export const MOV_KAUFMANN = "mov-kaufmann";
export const MOV_VOLCAN = "mov-volcan";
export const MOV_DATTATEC = "mov-dattatec";
export const MOV_TERCEROS = "mov-terceros";
export const MOV_ENTEL_1 = "mov-entel-1";
export const MOV_ENTEL_2 = "mov-entel-2";
export const MOV_ENTEL_3 = "mov-entel-3";

export const CUENTA_SOFTWARE = "acc-software";
export const CUENTA_ARRIENDO = "acc-arriendo";
export const CUENTA_HONORARIOS = "acc-honorarios";
export const CUENTA_TELECOM = "acc-telecom";
export const CUENTA_REMUNERACIONES = "acc-remuneraciones";

/* ── Conciliar ───────────────────────────────────────────────────────────────────────────── */

/** La cola de revisión (score 60-90): dos casos, uno con evidencia y otro sin ella. */
export function colaConciliar(over: Partial<ReviewQueueResponse> = {}): ReviewQueueResponse {
  const items = [
    {
      movement_id: MOV_KAUFMANN,
      date: "2026-08-26",
      amount: "2380000",
      description: `TRANSFERENCIA DE COMERCIAL KAUFMANN ${RUT_KAUFMANN} FAC 435`,
      suggestion: {
        document_kind: "receivable",
        document_id: "doc-435",
        name: "Comercial Kaufmann S.A.",
        score: "78",
        document_count: 1,
      },
    },
    {
      movement_id: MOV_VOLCAN,
      date: "2026-04-14",
      amount: "1033076",
      description: "ABONO TRANSFERENCIA MIRKO GONZALEZ",
      suggestion: {
        document_kind: "receivable",
        document_id: "doc-451",
        name: "Cia. Industrial El Volcan S.A.",
        score: "62",
        document_count: 1,
      },
    },
  ];
  return { items, count: items.length, ...over };
}

/** Candidatos del abono de Kaufmann ("elegir otro" ya devuelve folio/fecha/monto). */
export function candidatosKaufmann(): DocumentSuggestionsResponse {
  return {
    movement_id: MOV_KAUFMANN,
    suggestions: [
      {
        document_id: "doc-435",
        kind: "receivable",
        document_type: 33,
        folio: "435",
        rut: RUT_KAUFMANN,
        name: "Comercial Kaufmann S.A.",
        amount: "2380000",
        date: "2026-08-05",
        score: 78,
        reasons: ["rut", "folio", "monto"],
      },
      {
        document_id: "doc-428",
        kind: "receivable",
        document_type: 33,
        folio: "428",
        rut: RUT_KAUFMANN,
        name: "Comercial Kaufmann S.A.",
        amount: "1980000",
        date: "2026-07-14",
        score: 41,
        reasons: ["rut"],
      },
    ],
  };
}

/** Candidatos del abono de Mirko González: el único que hay es el del Volcán, y no calza. */
export function candidatosVolcan(): DocumentSuggestionsResponse {
  return {
    movement_id: MOV_VOLCAN,
    suggestions: [
      {
        document_id: "doc-451",
        kind: "receivable",
        document_type: 33,
        folio: "451",
        rut: RUT_VOLCAN,
        name: "Cia. Industrial El Volcan S.A.",
        amount: "1063341",
        date: "2026-08-19",
        score: 62,
        reasons: ["monto_aproximado"],
      },
    ],
  };
}

export function colaConciliarVacia(): ReviewQueueResponse {
  return { items: [], count: 0 };
}

/* ── Clasificar ──────────────────────────────────────────────────────────────────────────── */

function movimiento(over: Partial<BankMovement> & Pick<BankMovement, "id">): BankMovement {
  return {
    bank_account_id: "cuenta-bice-1",
    external_id: `ext-${over.id}`,
    date: "2026-08-21",
    description: "",
    amount: "0",
    direction: "debit",
    currency_source: "account_context",
    reconciliation_status: "unmatched",
    data_status: "available",
    imported_at: "2026-08-22T09:00:00Z",
    classification_status: "unclassified",
    ...over,
  };
}

/** Sin clasificar: uno con regla que calza, uno sin nada, y tres de la misma contraparte (lote). */
export function sinClasificar(
  orden: readonly string[] = [MOV_DATTATEC, MOV_TERCEROS, MOV_ENTEL_1, MOV_ENTEL_2, MOV_ENTEL_3],
): BankMovementsListResponse {
  const todos: Record<string, BankMovement> = {
    [MOV_DATTATEC]: movimiento({
      id: MOV_DATTATEC,
      date: "2026-08-18",
      description: `PAGO SERVICIOS DATTATEC.COM ${RUT_DATTATEC}`,
      amount: "89250",
      direction: "debit",
    }),
    [MOV_TERCEROS]: movimiento({
      id: MOV_TERCEROS,
      date: "2026-08-21",
      description: "TRANSF. A TERCEROS VIA INTERNET",
      amount: "381375",
      direction: "debit",
    }),
    [MOV_ENTEL_1]: movimiento({
      id: MOV_ENTEL_1,
      date: "2026-08-12",
      description: `PAC ENTEL PCS ${RUT_ENTEL}`,
      amount: "203607",
      direction: "debit",
    }),
    [MOV_ENTEL_2]: movimiento({
      id: MOV_ENTEL_2,
      date: "2026-07-12",
      description: `PAC ENTEL PCS ${RUT_ENTEL}`,
      amount: "198430",
      direction: "debit",
    }),
    [MOV_ENTEL_3]: movimiento({
      id: MOV_ENTEL_3,
      date: "2026-06-12",
      description: `PAC ENTEL PCS ${RUT_ENTEL}`,
      amount: "201118",
      direction: "debit",
    }),
  };
  const items = orden.map((id) => todos[id]).filter((m): m is BankMovement => m != null);
  return { items, total: items.length };
}

export function sinClasificarVacio(): BankMovementsListResponse {
  return { items: [], total: 0 };
}

/** Historial ya clasificado, del que salen los "3 frecuentes" cuando no hay regla. */
export function clasificados(): BankMovement[] {
  const arriendos = [1, 2, 3, 4].map((n) =>
    movimiento({
      id: `cls-arriendo-${n}`,
      description: "ARRIENDO OFICINA",
      amount: "1100000",
      direction: "debit",
      management_account_id: CUENTA_ARRIENDO,
      classification_status: "classified",
    }),
  );
  const honorarios = [1, 2, 3].map((n) =>
    movimiento({
      id: `cls-honorarios-${n}`,
      description: "HONORARIOS PROFESIONALES",
      amount: "450000",
      direction: "debit",
      management_account_id: CUENTA_HONORARIOS,
      classification_status: "classified",
    }),
  );
  const software = [1, 2].map((n) =>
    movimiento({
      id: `cls-software-${n}`,
      description: "SUSCRIPCION SOFTWARE",
      amount: "350000",
      direction: "debit",
      management_account_id: CUENTA_SOFTWARE,
      classification_status: "classified",
    }),
  );
  /* Fuera de la banda de monto (×3): existe, pero no puede colarse entre los frecuentes de un
     cargo de $381.375 — es justo lo que el criterio de banda tiene que dejar afuera. */
  const sueldos = [1, 2, 3, 4, 5].map((n) =>
    movimiento({
      id: `cls-sueldos-${n}`,
      description: "REMUNERACIONES",
      amount: "8000000",
      direction: "debit",
      management_account_id: CUENTA_REMUNERACIONES,
      classification_status: "classified",
    }),
  );
  return [...arriendos, ...honorarios, ...software, ...sueldos];
}

/** El catálogo de cuentas de gestión seleccionables. */
export function cuentas(): OpcionCuentaV07[] {
  return [
    { id: CUENTA_ARRIENDO, nombre: "Arriendo de oficina", seleccionable: true },
    { id: CUENTA_HONORARIOS, nombre: "Honorarios", seleccionable: true },
    { id: CUENTA_SOFTWARE, nombre: "Software y tecnología", seleccionable: true },
    { id: CUENTA_TELECOM, nombre: "Telecomunicaciones", seleccionable: true },
    { id: CUENTA_REMUNERACIONES, nombre: "Remuneraciones", seleccionable: true },
  ];
}

function categoriaCanonica(
  code: string,
  label: string,
  expectedDirection: "credit" | "debit" | "any",
): CanonicalCategoryMeta {
  return {
    code,
    label,
    description: `${label} de prueba`,
    expected_direction: expectedDirection,
    cashflow_group: expectedDirection === "credit" ? "cash_in" : "cash_out",
    default_financial_model: "cash_flow",
    default_impact_type: expectedDirection === "credit" ? "cash_in" : "cash_out",
    default_management_root: "cash",
    requires_review: false,
    affects_operational_result_by_default: false,
    is_internal_movement: false,
    allowed_for_bank_movement: true,
    sort_order: 10,
  };
}

/** Catálogo vivo reducido para stories/tests de la Bandeja. */
export function categoriasCanonicas(): CanonicalCategoryMeta[] {
  return [
    categoriaCanonica("client_collection", "Cobro de cliente", "credit"),
    categoriaCanonica("supplier_payment", "Pago a proveedor", "debit"),
    categoriaCanonica("operational_expense", "Gasto operacional", "debit"),
    categoriaCanonica("unknown", "Por revisar", "any"),
  ];
}

/** `GET .../{id}/suggested-category` con una regla que SÍ matchea. */
export function categoriaSugeridaDattatec(): SuggestedCategoryResponse {
  return {
    movement_id: MOV_DATTATEC,
    suggestion: {
      account_code: "5.2.03",
      account_name: "Software y tecnología",
      canonical_category: "operational_expense",
      confidence: 0.92,
      matched_rule_id: "regla-dattatec",
    },
  };
}

/** Ninguna regla activa matchea: `suggestion: null`. El backend NO inventa, y la vista tampoco. */
export function categoriaSinSugerencia(movementId = MOV_TERCEROS): SuggestedCategoryResponse {
  return { movement_id: movementId, suggestion: null };
}

/** La sugerencia ya resuelta contra el catálogo, como la recibe la vista. */
export function sugerenciaSoftware(): SugerenciaCategoriaV07 {
  return {
    cuentaId: CUENTA_SOFTWARE,
    categoriaCanonica: "operational_expense",
    nombre: "Software y tecnología",
    confianza: 0.92,
    reglaId: "regla-dattatec",
  };
}
