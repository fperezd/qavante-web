/* Helpers de accesibilidad por teclado. PUROS/testeables (sin DOM). */

/** Índice siguiente en un grupo tipo radiogroup/tabs según la flecha (con wrap):
 *  →/↓ avanza, ←/↑ retrocede. `null` si la tecla no navega. */
export function rovingIndex(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  if (key === "ArrowRight" || key === "ArrowDown") return (current + 1) % count;
  if (key === "ArrowLeft" || key === "ArrowUp") return (current - 1 + count) % count;
  return null;
}
