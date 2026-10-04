/* Nombres de pantalla que se repiten en más de un lugar de la navegación.

   `/pagar/obligaciones` se llamaba de dos maneras a la vez: el sidebar decía
   "Obligaciones con entidades financieras" y el command palette (⌘K) y el enlace
   desde Pagar decían "Préstamos y obligaciones". La misma pantalla con dos nombres
   según por dónde llegaras. Nada lo impedía porque cada lugar escribía el string a
   mano.

   Cuando un nombre vive en un solo lugar, no se puede desalinear. Acá viven sólo los
   que de verdad se repiten: el sidebar y el command palette usan nombres distintos a
   propósito en varias pantallas (el palette es más descriptivo porque se busca por
   texto), así que esto NO es un catálogo de toda la navegación. */

export const OBLIGACIONES_FINANCIERAS = "Obligaciones con entidades financieras";
