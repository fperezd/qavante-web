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
  MovimientosDeCuentasRetiradas,
} from "@/lib/api/treasury";
import type { DocumentSuggestionsResponse, ReviewQueueResponse } from "@/lib/api/reconciliation";
import type { SuggestedCategoryResponse } from "@/lib/api/classification-rules";
import type { OpcionCuentaV07, SugerenciaCategoriaV07 } from "./bandeja-v07-model";

export const HOY = new Date("2026-08-30T12:00:00Z");

export const RUT_KAUFMANN = "96572360-9";
export const RUT_VOLCAN = "81201000-K";
export const RUT_ANDINA = "79876543-2";
export const RUT_SUR = "76543210-5";
export const RUT_DATTATEC = "76888888-8";
export const RUT_ENTEL = "92580000-7";

export const MOV_KAUFMANN = "mov-kaufmann";
export const MOV_VOLCAN = "mov-volcan";
export const MOV_EXCEDE = "mov-excede";
export const MOV_DATTATEC = "mov-dattatec";
export const MOV_TERCEROS = "mov-terceros";
export const MOV_ENTEL_1 = "mov-entel-1";
export const MOV_ENTEL_2 = "mov-entel-2";
export const MOV_ENTEL_3 = "mov-entel-3";
export const MOV_CARGO_PARCIAL = "mov-cargo-parcial";
export const MOV_CARGO_EXCESO = "mov-cargo-exceso";

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
      currency_code: "CLP",
      description: `TRANSFERENCIA DE COMERCIAL KAUFMANN ${RUT_KAUFMANN} FAC 435`,
      suggestion: {
        document_kind: "receivable",
        document_id: "doc-435",
        name: "Comercial Kaufmann S.A.",
        score: "78",
        document_count: 1,
        bulk_eligible: true,
        can_confirm: true,
        topology: "1:1",
      },
    },
    {
      movement_id: MOV_VOLCAN,
      date: "2026-04-14",
      amount: "1033076",
      currency_code: "CLP",
      description: "ABONO TRANSFERENCIA MIRKO GONZALEZ",
      suggestion: {
        document_kind: "receivable",
        document_id: "doc-451",
        name: "Cia. Industrial El Volcan S.A.",
        score: "62",
        document_count: 1,
        bulk_eligible: false,
        can_confirm: false,
        topology: "1:1",
      },
    },
  ];
  return { items, count: items.length, ...over };
}

/**
 * EL CASO DE LA CAPTURA DE FERNANDO, en su propia cola para no mover los conteos de las otras.
 *
 * La evidencia de la Ley 3 PASA (el RUT está en la glosa), así que la compuerta vieja del front
 * ofrecía "Sí, conciliar". Pero el movimiento supera el saldo del documento, así que el backend
 * responde 409 siempre: `can_confirm` es false y el `blocker` lo nombra con el monto.
 */
export function colaConciliarExcede(): ReviewQueueResponse {
  const items = [
    {
      movement_id: MOV_EXCEDE,
      date: "2026-08-28",
      amount: "2400000",
      currency_code: "CLP",
      description: `TRANSFERENCIA ANDINA LTDA ${RUT_ANDINA} FAC 712`,
      suggestion: {
        document_kind: "receivable",
        document_id: "doc-712",
        name: "Andina Ltda.",
        score: "84",
        document_count: 1,
        bulk_eligible: false,
        can_confirm: false,
        blocker: {
          code: "movement_exceeds_document",
          message: "El movimiento supera en $380.000 el saldo del documento.",
          retryable: false,
        },
        topology: "1:1",
      },
    },
  ];
  return { items, count: items.length };
}

/** Candidatos del abono de Andina: el documento existe y es el correcto, pero no alcanza. */
export function candidatosExcede(): DocumentSuggestionsResponse {
  return {
    movement_id: MOV_EXCEDE,
    suggestions: [
      {
        document_id: "doc-712",
        kind: "receivable",
        document_type: 33,
        folio: "712",
        rut: RUT_ANDINA,
        name: "Andina Ltda.",
        amount: "2020000",
        date: "2026-08-10",
        score: 84,
        confirmable: false,
        blocker: {
          code: "movement_exceeds_document",
          message: "El movimiento supera en $380.000 el saldo del documento.",
          retryable: false,
        },
        reasons: ["rut", "folio"],
      },
    ],
  };
}

/**
 * B12 — UN CARGO CONTRA UNA FACTURA DE PROVEEDOR. `document_kind: "payable"` ⇒ la plata SALE.
 *
 * Existe para que los verbos de la carta se puedan probar en las DOS direcciones: con sólo
 * `receivable` en las fixtures, una copia con verbos fijos pasaba todos los tests. Dos casos:
 * `MOV_CARGO_PARCIAL` paga de menos (queda saldo POR PAGAR) y `MOV_CARGO_EXCESO` paga de más
 * (SALIÓ más que el documento).
 */
export function colaConciliarCargos(): ReviewQueueResponse {
  const items = [
    {
      movement_id: MOV_CARGO_PARCIAL,
      date: "2026-08-20",
      amount: "1000000",
      currency_code: "CLP",
      description: `PAGO PROVEEDOR SUMINISTROS DEL SUR ${RUT_SUR} FAC 900`,
      suggestion: {
        document_kind: "payable",
        document_id: "doc-900",
        name: "Suministros del Sur Ltda.",
        score: "70",
        document_count: 1,
        bulk_eligible: false,
        can_confirm: false,
        topology: "1:1",
      },
    },
    {
      movement_id: MOV_CARGO_EXCESO,
      date: "2026-08-21",
      amount: "1183801",
      currency_code: "CLP",
      description: `PAGO PROVEEDOR SUMINISTROS DEL SUR ${RUT_SUR} FAC 901`,
      suggestion: {
        document_kind: "payable",
        document_id: "doc-901",
        name: "Suministros del Sur Ltda.",
        score: "70",
        document_count: 1,
        bulk_eligible: false,
        can_confirm: false,
        topology: "1:1",
      },
    },
  ];
  return { items, count: items.length };
}

/** El documento del cargo parcial: $1.005.171 de los que se pagaron $1.000.000. */
export function candidatosCargoParcial(): DocumentSuggestionsResponse {
  return {
    movement_id: MOV_CARGO_PARCIAL,
    suggestions: [
      {
        document_id: "doc-900",
        kind: "payable",
        document_type: 33,
        folio: "900",
        rut: RUT_SUR,
        name: "Suministros del Sur Ltda.",
        amount: "1005171",
        date: "2026-08-18",
        score: 70,
        confirmable: true,
        reasons: ["rut", "folio"],
      },
    ],
  };
}

/** El documento del cargo con exceso: $1.000.000 contra un pago de $1.183.801. */
export function candidatosCargoExceso(): DocumentSuggestionsResponse {
  return {
    movement_id: MOV_CARGO_EXCESO,
    suggestions: [
      {
        document_id: "doc-901",
        kind: "payable",
        document_type: 33,
        folio: "901",
        rut: RUT_SUR,
        name: "Suministros del Sur Ltda.",
        amount: "1000000",
        date: "2026-08-19",
        score: 70,
        confirmable: true,
        reasons: ["rut", "folio"],
      },
    ],
  };
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
        confirmable: true,
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
        confirmable: true,
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
        confirmable: true,
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
    /* La moneda viaja en la fixture porque el contrato la publica: `currency_code` al lado de un
       `currency_source` obligatorio. Una fixture sin moneda no reproduce el contrato vivo, y la
       pantalla la rinde como "moneda no informada" — que es honesto, pero no es el caso de prod. */
    currency_code: "CLP",
    currency_source: "account_context",
    reconciliation_quarantined: false,
    reconciliation_status: "unmatched",
    data_status: "available",
    imported_at: "2026-08-22T09:00:00Z",
    classification_status: "unclassified",
    ...over,
  };
}

/* #1118 - `cuentas_retiradas`: lo que api#1126 dejó FUERA del listado por venir de una cuenta
   bancaria retirada. Las dos leyendas de abajo están copiadas VERBATIM de `_retired_legend`
   del productor (`api/app/core/treasury_repo.py`): la pantalla pinta la del backend, nunca una
   propia, así que el fixture tampoco puede inventar una. Si el backend cambia el texto, estos
   fixtures se actualizan desde ahí, no al revés. */

/** El caso normal: ninguna cuenta retirada aporta nada. `movimientos: 0` es una CIFRA
 *  ("no quedó nada fuera"), no una ausencia, y el backend igual manda su leyenda. */
export function sinCuentasRetiradas(): MovimientosDeCuentasRetiradas {
  return {
    movimientos: 0,
    cuentas: 0,
    desde: null,
    hasta: null,
    leyenda: "Ninguna cuenta retirada aporta movimientos a este listado.",
  };
}

/** Lo MEDIDO en producción para la BICE duplicada de #1007: 405 movimientos en pesos y 12 en
 *  dólares, 417 en total, del 02-01-2026 al 08-09-2026, repartidos en 2 cuentas retiradas. */
export function cuentasRetiradasBice(): MovimientosDeCuentasRetiradas {
  return {
    movimientos: 417,
    cuentas: 2,
    desde: "2026-01-02",
    hasta: "2026-09-08",
    leyenda:
      "417 movimientos de 2 cuentas retiradas quedan fuera de este listado, " +
      "del 02-01-2026 al 08-09-2026. Siguen guardados: no se borró nada.",
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
  return { items, total: items.length, cuentas_retiradas: sinCuentasRetiradas() };
}

export function sinClasificarVacio(): BankMovementsListResponse {
  return { items: [], total: 0, cuentas_retiradas: sinCuentasRetiradas() };
}

/** El MOVIMIENTO EN DÓLARES del hallazgo B04: `US$5.862,30` se veía como "$5.862" en Bandeja.
 *  Su gemelo en pesos son los de `sinClasificar()`, que tienen que seguir sin decimales. */
export const MOV_USD = "mov-usd";
/** Dólares REDONDOS: los decimales en cero no son excusa para perder la moneda (`US$5.344,00`). */
export const MOV_USD_REDONDO = "mov-usd-redondo";

export function sinClasificarDolares(): BankMovementsListResponse {
  const items = [
    movimiento({
      id: MOV_USD,
      date: "2026-08-20",
      description: "COMPRA INTERNACIONAL AWS",
      amount: "5862.30",
      direction: "debit",
      currency_code: "USD",
      currency_source: "bank_declared",
    }),
    movimiento({
      id: MOV_USD_REDONDO,
      date: "2026-08-19",
      description: "COMPRA INTERNACIONAL GITHUB",
      amount: "5344",
      direction: "debit",
      currency_code: "USD",
      currency_source: "bank_declared",
    }),
  ];
  return { items, total: items.length, cuentas_retiradas: sinCuentasRetiradas() };
}

/** Movimiento histórico SIN moneda declarada (`legacy_unknown`): la pantalla no puede inventarla. */
export function sinClasificarSinMoneda(): BankMovementsListResponse {
  const items = [
    movimiento({
      id: "mov-sin-moneda",
      date: "2026-08-18",
      description: "CARGO SIN MONEDA DECLARADA",
      amount: "5344",
      direction: "debit",
      currency_code: null,
      currency_source: "legacy_unknown",
    }),
  ];
  return { items, total: items.length, cuentas_retiradas: sinCuentasRetiradas() };
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
