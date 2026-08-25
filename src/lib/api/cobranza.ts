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

export type TopDebtor = components["schemas"]["TopDebtor"];

export type OverdueDocument = components["schemas"]["OverdueDocument"];

export type AccountsReceivableResponse = GenAccountsReceivable;

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
