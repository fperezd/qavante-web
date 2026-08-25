import type { ReactElement } from "react";

/* Contenido que efectivamente PINTA algo.
 *
 * `React.ReactNode` incluye `undefined`, `null` y booleanos — todos renderizan
 * la nada. Para los slots del design system que existen para *decir* algo (el
 * valor de un KPI, el motivo de un "sin dato", la causa de un error) aceptar
 * esos tipos es abrirle la puerta a un panel mudo sin que el compilador chiste.
 * Este alias los deja fuera.
 *
 * Lo que este tipo NO puede expresar, y hay que saberlo: una cadena vacía o
 * con solo espacios sigue siendo un `string` válido. Codificar "string no
 * vacío" exige volver genérico cada componente que lo use (`<V extends string>`
 * con un condicional `V extends "" ? never : V`), lo que rompe la inferencia en
 * cada call site y en las stories de Storybook. El precio no compensa el hueco:
 * ese caso se cubre en runtime con `estaVacio`, mostrando explícitamente que no
 * tenemos el motivo en vez de pintar un panel vacío. */
export type ContenidoVisible = string | number | ReactElement;

/** true si el contenido no va a pintar nada legible (ausente o solo espacios). */
export function estaVacio(contenido: ContenidoVisible | undefined): boolean {
  if (contenido === undefined) return true;
  if (typeof contenido === "string") return contenido.trim().length === 0;
  return false;
}
