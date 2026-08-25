/* Parseo de los montos que el backend manda como STRING decimal ("18500000",
   "-300000.50", "", null). Esto vivía copiado carácter por carácter en cuatro
   módulos de dominio (cobrar / gestión / inicio / pagar), cada uno con su
   comentario diciendo "consolidación pendiente". Cuatro copias de una función de
   plata son cuatro lugares donde arreglar un bug y tres donde olvidarlo.

   Vive en `formatters/` y no en un dominio porque ninguno de los cuatro es dueño:
   el string-decimal es el contrato de TRANSPORTE del API, transversal a todas las
   pantallas. */

/** String-decimal del backend → number. Vacío / no numérico → `0`.

    Ojo con el `0`: es una defensa contra basura del transporte, NO un "no se
    sabe". Si el campo puede legítimamente venir sin dato, usa
    `parseAmountOrNull` — aplastar "no se sabe" a `0` es la pantalla afirmando
    "cero pesos" sobre datos que no tiene. */
export function parseAmount(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** String-decimal del backend → number PRESERVANDO el "no se sabe": `null` /
    `undefined` / vacío / en blanco / no numérico → `null`.

    `"0"` → `0`: el cero VERIFICADO se conserva como cero. Confundirlo con
    desconocido es tan mentiroso como el camino inverso.

    El `trim()` importa: `Number(" ")` da `0`, así que un string en blanco sin
    recortar se convertiría en "$0" en pantalla. */
export function parseAmountOrNull(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
