import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

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

/** Vuelve nullable un subconjunto de campos de un tipo GENERADO, conservando el
 *  resto tal cual viene del contrato.
 *
 *  El `K extends keyof T` es el guardarraíl: si el backend renombra o elimina uno
 *  de los campos overrideados, la clave deja de existir en `T` y esto NO COMPILA.
 *  Sin esa restricción, `Omit` acepta claves inexistentes en silencio y volvemos
 *  al problema original (el cambio de contrato pasa mudo). */
type NullableOverride<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null };

/** Reemplaza el TIPO de un campo del contrato por otro. Hace falta `Omit` de verdad:
 *  intersectar `Gen & { aging: ReceivableAging }` NO reemplaza nada — deja
 *  `ARAging & ReceivableAging`, y `string & (string | null)` colapsa a `string`, o
 *  sea el override quedaba mudo (justo el problema que este archivo viene a
 *  resolver). Mismo guardarraíl `K extends keyof T` que `NullableOverride`. */
type Replace<T, K extends keyof T, V> = Omit<T, K> & { [P in K]: V };

/* ── DEUDA CONTROLADA: override a mano de qavante-api#123 ──────────────────────
 * `npm run generate:api` apunta al openapi de **producción**
 * (`https://api.qavante.com/openapi.json`, ver package.json). qavante-api#123
 * todavía NO está deployado, así que el openapi de prod sigue declarando
 * `overdue`/`overdue_pct`/los buckets de mora como `string` no-null y no conoce
 * `undated_amount`. Regenerar hoy REVERTIRÍA el contrato nuevo.
 *
 * Por eso el contrato nuevo se expresa como un override MÍNIMO y verificable
 * sobre el tipo generado, en vez de re-declarar la respuesta entera a mano.
 *
 * QUÉ HACER CUANDO #123 ESTÉ EN PROD: correr `npm run generate:api` y borrar los
 * `NullableOverride` + el `undated_amount` de acá abajo, dejando
 * `export type AccountsReceivableResponse = GenAccountsReceivable;`. Si algo se
 * rompe al borrarlos, el contrato NO quedó como se acordó. */

/** Antigüedad de saldos (aging) — montos string-decimal CLP.
 *
 *  Los cuatro tramos de MORA pueden venir `null` = "no se pudo computar"
 *  (qavante-api#123). `current` (vigente) NUNCA es null. La clave siempre viene;
 *  lo que puede faltar es el valor. */
export type ReceivableAging = NullableOverride<
  GenARAging,
  "d1_30" | "d31_60" | "d61_90" | "d90_plus"
>;

export type TopDebtor = components["schemas"]["TopDebtor"];

export type OverdueDocument = components["schemas"]["OverdueDocument"];

export type AccountsReceivableResponse = Replace<
  NullableOverride<GenAccountsReceivable, "overdue" | "overdue_pct">,
  /** Aging con los tramos de mora nullables (ver `ReceivableAging`). */
  "aging",
  ReceivableAging
> & {
  /** Saldo por cobrar VIVO que no tiene fecha de vencimiento (string-decimal CLP).
   *  Es el dato que EXPLICA por qué `overdue` viene null: sin fecha no hay forma
   *  de saber si está vencido. Espeja `undated_amount` de accounts-payable. */
  undated_amount?: string | null;
};

export const cobranzaKeys = {
  all: ["cobranza"] as const,
  accountsReceivable: () => [...cobranzaKeys.all, "accounts-receivable"] as const,
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
