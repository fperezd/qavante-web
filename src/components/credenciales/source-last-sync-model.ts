import type { SourceStatus } from "@/lib/api/sources-status";

/* "Sin sincronizar todavía" ≠ "no pudimos preguntar" (§13: faltante ≠ 0).

   `GET /api/sources/status` es api-key-only → con cookie da 401, `data` queda undefined y la línea
   afirmaba "Sin sincronizar todavía" SIEMPRE, aunque la fuente hubiera sincronizado. Está vivo en
   prod en las tarjetas del banco y del SII. Esta función solo deja afirmar cuando de verdad
   sabemos: si no pudimos preguntar, no se muestra nada (callar es honesto; mentir no).

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
