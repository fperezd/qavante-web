/* Cómo se le cuenta al usuario el resultado del sync inicial, por fuente. SIN
   React → testeable.

   Contrato: `SyncSourceResult.status` de `POST /api/onboarding/sync`. Hoy en prod
   son `ok | failed | skipped`; el qavante-api #955 suma **`queued`** — el banco no
   sincroniza dentro del request (login + scraping de BICE, ADR-0059): el pedido
   queda anotado y lo corre el cron de bancos. Un `queued` NO es "listo": es
   "todavía no hay datos", y así hay que decirlo.

   Por qué es una función y no un `Record` indexado directo: el mapa anterior era
   `{ok, failed, skipped}` y se indexaba con el status crudo del backend, así que
   un valor nuevo (justamente `queued`) renderizaba **texto vacío** — "Banco:" y
   nada. Un estado que no conocemos se dice, no se calla ni se pinta como éxito. */

export const SYNC_STATUS_TEXT: Record<string, string> = {
  ok: "sincronizado",
  // #955: el sync del banco corre fuera del request; los datos aparecen después.
  queued: "sincronizando en segundo plano (los datos aparecen en un rato)",
  failed: "no se pudo conectar",
  skipped: "no conectado (lo puedes conectar después)",
};

/** Texto para el usuario. Estado desconocido o ausente → lo decimos, nunca lo
 *  presentamos como sincronizado. */
export function syncStatusText(status: string | null | undefined): string {
  if (!status) return "sin confirmar";
  return SYNC_STATUS_TEXT[status] ?? "estado no confirmado";
}
