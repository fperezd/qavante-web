/* Fixtures de V03 · Banco, compartidas por el test del modelo, el de la vista y las stories.
 *
 * Todo SINTÉTICO: ningún monto, id ni nombre es de un tenant real. Los números están elegidos para
 * que las afirmaciones sean legibles (la suma CLP del banco = `cash_today` en el caso normal, y
 * distinta en el caso que lo contradice). */

import type { DashboardSummaryV2 } from "@/lib/api/dashboard";
import type { SourceStatus } from "@/lib/api/sources-status";
import type {
  BankAccountItem,
  BankMovement,
  BiceAccount,
  SaldoResponse,
  TarjetaSaldoData,
  TarjetasResponse,
} from "@/lib/api/treasury";

/* NOTA DE ZONA HORARIA (B16). Los sellos de estas fixtures son INSTANTES en UTC y la pantalla
   los muestra en el día de CHILE. Un `...T00:12:00Z` NO es "hoy temprano": en agosto Chile está
   en UTC-4, así que las 00:12Z son las 20:12 del día ANTERIOR. Estas fixtures lo tenían así y
   los tests lo leían como "hoy" porque el formateador devolvía el día en UTC — la misma causa
   del «actualizada mañana» que reportó el dueño del producto. Las horas son 12:xx Z (08:xx en
   Chile) para que el día del sello y el día que se quiere afirmar sean el mismo. */
export const HOY = new Date("2026-08-30T12:00:00Z");
export const BANCO = "BICE";

export function summary(over: Partial<DashboardSummaryV2> = {}): DashboardSummaryV2 {
  return {
    executive_phrase: null,
    pulso: null,
    cash_today: {
      total: "9800000",
      last_updated: "2026-08-30T12:12:00Z",
      data_state: "available",
    },
    cash_forecast: null,
    cash_gap: null,
    overdue_collections: null,
    critical_payments: null,
    operational_result: null,
    priority_actions: [],
    ...over,
  } as DashboardSummaryV2;
}

/** `cash_today` viejo (dos días) y marcado `stale` — el caso vivo con el banco caído. */
export const SUMMARY_STALE = summary({
  cash_today: { total: "9800000", last_updated: "2026-08-28T12:00:00Z", data_state: "stale" },
});

export function saldoOk(): SaldoResponse {
  return {
    status: "ok",
    cached: false,
    as_of: "2026-08-30T12:12:00Z",
    cuentas: [
      {
        numeroCuenta: "tok-clp",
        numeroFormateado: "12-34567-8",
        nombreCuenta: "Cuenta Corriente CLP",
        codigoProducto: "100",
        codigoMoneda: "CLP",
        esExtranjera: false,
        moneda: "CLP",
        saldoContable: "9800000",
        saldoDisponible: "9500000",
      },
      {
        numeroCuenta: "tok-usd",
        numeroFormateado: "12-34567-9",
        nombreCuenta: "Cuenta Corriente USD",
        codigoProducto: "101",
        codigoMoneda: "USD",
        esExtranjera: true,
        moneda: "USD",
        saldoContable: "1240.00",
        saldoDisponible: "1240.00",
      },
    ],
  };
}

/** La forma REAL del endpoint con la sesión vencida (estructura verificada 2026-08-30): HTTP 200
 *  con cuerpo de error y `cuentas: []`. */
export function saldoSesionVencida(): SaldoResponse {
  return {
    status: "error",
    cuentas: [],
    cached: false,
    as_of: "2026-08-30T10:00:00Z",
    code: "session_expired",
    message: "Sesión BICE no disponible (reconectar)",
    error: "BiceAuthError",
  } as SaldoResponse;
}

export function tarjetasOk(): TarjetasResponse {
  return {
    status: "ok",
    data: [
      {
        operationNumber: "9876543210",
        product: "Tarjeta de Crédito",
        holder: "Titular",
        isActive: true,
      },
    ],
  };
}

export function tarjetasSesionVencida(): TarjetasResponse {
  return {
    status: "error",
    data: [],
    code: "session_expired",
    message: "Sesión BICE no disponible (reconectar)",
  } as TarjetasResponse;
}

export function saldoTarjetas(): Map<string, TarjetaSaldoData> {
  return new Map([
    [
      "9876543210",
      {
        national: { totalQuota: 2000000, spentQuota: 250000, availableQuota: 1750000 },
        international: { totalQuota: 3000, spentQuota: 184, availableQuota: 2816 },
      } as TarjetaSaldoData,
    ],
  ]);
}

export function cuentasQavante(): BankAccountItem[] {
  return [
    {
      id: "acc-clp",
      name: "Cuenta Corriente CLP",
      bank_name: "BICE",
      currency_code: "CLP",
      account_type: "checking",
      active: true,
      account_number_display: "**** **** **** 5678",
    },
    {
      id: "acc-usd",
      name: "Cuenta Corriente USD",
      bank_name: "BICE",
      currency_code: "USD",
      account_type: "checking",
      active: true,
      account_number_display: "**** **** **** 5679",
    },
  ];
}

/** LA FORMA DE PRODUCCIÓN (medida el 2026-10-05): las dos cuentas BICE de Tooxs tienen el MISMO
 *  `name`, "Cuenta Corriente", y lo único que las distingue es la moneda. La fixture de arriba
 *  nombra la moneda dentro del `name` y por eso no reproducía el hallazgo B28. */
export function cuentasQavanteMismoNombre(): BankAccountItem[] {
  return cuentasQavante().map((a) => ({ ...a, name: "Cuenta Corriente" }));
}

export function links(): BiceAccount[] {
  return [
    { external_id: "12-34567-8", currency: "CLP", linked_bank_account_id: "acc-clp" },
    { external_id: "12-34567-9", currency: "USD", linked_bank_account_id: "acc-usd" },
  ];
}

export function sourcesOk(): SourceStatus[] {
  return [
    { source: "sii", state: "ok", last_sync: "2026-08-30T01:00:00Z", category: "tax" },
    {
      source: "bank_bice",
      state: "ok",
      last_sync: "2026-08-30T12:12:00Z",
      display_name: "Banco BICE",
      category: "bank",
    },
  ];
}

/** La forma REAL del agregado con la sesión caída (estructura verificada 2026-08-30). */
export function sourcesError(): SourceStatus[] {
  return [
    {
      source: "bank_bice",
      state: "error",
      reason: "BiceAuthError: Sesión BICE no disponible",
      last_sync: "2026-08-28T12:02:47Z",
      display_name: "Banco BICE",
      category: "bank",
    },
  ];
}

export function sourcesSyncing(): SourceStatus[] {
  return [
    {
      source: "bank_bice",
      state: "syncing",
      reason: "Trayendo la cartola",
      last_sync: "2026-08-29T12:12:00Z",
      display_name: "Banco BICE",
      category: "bank",
      sync_progress: {
        started_at: "2026-08-30T11:58:00Z",
        eta_seconds: 45,
        step: "Leyendo cartola",
      },
    },
  ];
}

export function sourcesSinConectar(): SourceStatus[] {
  return [{ source: "bank_bice", state: "missing", reason: "Sin credenciales", category: "bank" }];
}

export function categorias(): Map<string, string> {
  return new Map([
    ["client_collection", "Cobro de cliente"],
    ["tax_payment", "Impuestos"],
    ["payroll", "Remuneraciones"],
  ]);
}

function mov(over: Partial<BankMovement> & Pick<BankMovement, "id">): BankMovement {
  return {
    bank_account_id: "acc-clp",
    external_id: `doc:${over.id}`,
    date: "2026-08-20",
    description: "Movimiento",
    amount: "1000.00",
    direction: "debit",
    currency_code: "CLP",
    currency_source: "account_context",
    reconciliation_quarantined: false,
    canonical_category: null,
    management_account_id: null,
    reconciliation_status: "unmatched",
    match_score: null,
    matched_document_id: null,
    data_status: "available",
    imported_at: "2026-08-21T00:00:00Z",
    classified_at: null,
    classified_by: null,
    notes: null,
    classification_status: "unclassified",
    confidence: null,
    classification_notes: null,
    /* La procedencia por defecto es la de la mayoría de los movimientos de hoy: entraron por una
       carga que no mira contraparte (cartola, archivo de tarjeta, historial), así que nadie
       preguntó. No hubo relleno retroactivo a propósito: no se puede saber después si el banco la
       habría informado. */
    counterparty_name: null,
    counterparty_tax_id: null,
    counterparty_source: "not_captured",
    is_investment_or_extraordinary: false,
    ...over,
  };
}

/** Ocho movimientos que cubren el ciclo de vida completo:
 *   m1 abono conciliado · m2 cargo clasificado por conciliar · m3 cargo por clasificar ·
 *   m4 abono clasificado sólo por cuenta de gestión · m5 cargo conciliado · m6 cargo USD por
 *   clasificar (sugerido) · m7 "classified" SIN categoría (→ por clasificar) · m8 abono excluido
 *   de conciliación y sin clasificar.
 *
 *  Procedencia de contraparte, las tres cubiertas: m1 `bank_transfer_party` (el banco informó
 *  "Cliente Norte SpA" y su RUT) · m8 `not_published_by_bank` (se preguntó y no la publica) ·
 *  el resto `not_captured` (entraron por una carga que no la mira).
 *
 *  Conteos: todos 8 · abonos 3 · cargos 5 · por conciliar 5 (m2, m3, m4, m6, m7).
 *  Totales CLP: abonos +7.120.000 · cargos −7.966.983. USD: cargos −184. */
export function movimientos(): BankMovement[] {
  return [
    mov({
      id: "m1",
      date: "2026-08-21",
      description: "Abono por transferencia de Cliente Norte SpA 76.123.456-7",
      amount: "6000000.00",
      direction: "credit",
      /* La única procedencia que acredita identidad: el banco informó el titular de la otra
         cuenta de la transferencia. */
      counterparty_name: "Cliente Norte SpA",
      counterparty_tax_id: "76.123.456-7",
      counterparty_source: "bank_transfer_party",
      canonical_category: "client_collection",
      management_account_id: "ma-1",
      reconciliation_status: "matched",
      matched_document_id: "doc-450",
      classification_status: "classified",
    }),
    mov({
      id: "m2",
      date: "2026-08-20",
      description: "Pago SII F29",
      amount: "7450761.00",
      direction: "debit",
      canonical_category: "tax_payment",
      management_account_id: "ma-2",
      reconciliation_status: "unmatched",
      classification_status: "classified",
    }),
    mov({
      id: "m3",
      date: "2026-08-20",
      description: "Transf. Dattatec.com hosting",
      amount: "66222.00",
      direction: "debit",
    }),
    mov({
      id: "m4",
      date: "2026-08-21",
      description: "Abono aporte de socio",
      amount: "120000.00",
      direction: "credit",
      management_account_id: "ma-3",
      reconciliation_status: "review",
      classification_status: "classified",
    }),
    mov({
      id: "m5",
      date: "2026-08-19",
      description: "Nómina en línea agosto",
      amount: "400000.00",
      direction: "debit",
      canonical_category: "payroll",
      management_account_id: "ma-4",
      reconciliation_status: "matched",
      classification_status: "classified",
    }),
    mov({
      id: "m6",
      bank_account_id: "acc-usd",
      date: "2026-08-18",
      description: "Cargo tarjeta hosting internacional",
      amount: "184.00",
      direction: "debit",
      currency_code: "USD",
      reconciliation_status: "suggested",
    }),
    mov({
      id: "m7",
      date: "2026-08-15",
      description: "Comisión mantención cuenta",
      amount: "50000.00",
      direction: "debit",
      classification_status: "classified", // sin categoría ni cuenta de gestión: no hay nada detrás
    }),
    mov({
      id: "m8",
      date: "2026-08-10",
      description: "Abono transferencia sin identificar",
      amount: "1000000.00",
      direction: "credit",
      reconciliation_status: "excluded",
      /* Se le preguntó al proveedor por ESTE movimiento y no publica contraparte. Es la otra
         ausencia, y no es la misma que la de m3/m6. */
      counterparty_source: "not_published_by_bank",
    }),
  ];
}
