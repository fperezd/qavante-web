import type { SourceStatus } from "@/lib/api/sources-status";

/* "Sin sincronizar todavía" ≠ "no pudimos preguntar" (§13: faltante ≠ 0).

   Corrección (16-07-2026): al abrir este fix me apoyé en el comentario de `sources-status.ts`, que
   decía que el endpoint era api-key-only. Lo sondeé contra prod y es FALSO: `/api/sources/status`
   acepta cookie (devuelve `no_session`, no `"Falta X-Api-Key."`). O sea, la línea NO estaba
   mintiendo en prod como afirmé en el PR #582.

   La función igual vale, y por eso queda: distingue "nunca sincronizó" de "no pudimos preguntar",
   que es correcto ante CUALQUIER error (500, red caída, sesión vencida) y no solo ante el 401 que
   yo creía. Si no sabemos, no se muestra nada: callar es honesto; mentir no.

   Ojo con los códigos: la misma fuente se llama `bice` acá y `bank_bice` en el consent. Si el
   código no viene en la respuesta, tampoco afirmamos. */

export type UltimoSync = { mostrar: false } | { mostrar: true; last: string | null };

export type EntradaUltimoSync = {
  cargando: boolean;
  error: boolean;
  sources: SourceStatus[] | undefined;
  sourceCode: string;
};

export function ultimoSync(e: EntradaUltimoSync): UltimoSync {
  // Todavía preguntando, o no pudimos preguntar → no afirmamos nada.
  if (e.cargando || e.error || !e.sources) return { mostrar: false };

  const source = e.sources.find((s) => s.source === e.sourceCode);
  // La fuente no vino en la respuesta: no sabemos si nunca sincronizó o si el
  // backend no la conoce con ese código. No afirmamos.
  if (!source) return { mostrar: false };

  return { mostrar: true, last: source.last_sync ?? null };
}
