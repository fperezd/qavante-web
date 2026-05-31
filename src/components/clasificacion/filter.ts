/* Filtro de búsqueda compartido por los selectores de clasificación.
   Pura: sin estado, sin DOM — testeable de forma aislada. Match por
   substring, case/acentos-insensible (es-CL: "transferencia" matchea
   "Transferéncia"), sobre los campos indicados. */

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function filterByQuery<T>(
  items: readonly T[],
  query: string,
  keys: ReadonlyArray<keyof T>,
): T[] {
  const trimmed = query.trim();
  if (trimmed === "") return [...items];
  /* Si la query tenía contenido pero normalize() lo dejó vacío (el usuario
     tecleó solo diacríticos/símbolos como "´" o "^", que NFD+strip eliminan),
     NO devolvemos todo: una búsqueda no vacía no debe comportarse como vacía. */
  const q = normalize(trimmed);
  if (q === "") return [];
  return items.filter((item) =>
    keys.some((k) => {
      const v = item[k];
      return typeof v === "string" && normalize(v).includes(q);
    }),
  );
}
