/* Predicados PUROS del estado de sincronización de tesorería (sin React, unit-testeables).
   El componente `sync-pending-state.tsx` los re-exporta para no romper imports existentes. */

/** ¿El dato viene incompleto (falta sincronizar)? — para decidir entre el vacío
 *  honesto y el "no tienes deuda" real. `available` = dato COMPLETO: nunca es
 *  sync-pendiente, aunque venga con `missing_sources` residuales (#854: un
 *  "partial" con una fuente puntual no equivale a "sin credenciales"). */
export function isSyncPending(d: {
  data_state?: string;
  missing_sources?: string[] | null;
}): boolean {
  if (d.data_state === "available") return false;
  return d.data_state != null || (d.missing_sources?.length ?? 0) > 0;
}

/** ¿Hay datos pero incompletos (montos ok, vencimientos no)? */
export function isPartial(d: { data_state?: string }): boolean {
  return d.data_state != null && d.data_state !== "available";
}
