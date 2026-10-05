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

/* Las dos declaraciones de fecha del arranque, que se parecen y no son lo mismo. Fernando
   mismo no distinguía una de otra el 2026-10-04, y el productor las separó en el contrato:
   la fecha de inicio es un hecho histórico por sociedad y sin cota (puede ser 2017); el mes
   desde el que leemos es una decisión operativa de volumen, acotada a seis meses antes del
   alta. Los dos rótulos se nombran en el modelo del paso y en su pantalla, así que viven
   acá: si alguien renombra uno, no queda la mitad de la app llamándolo de otra manera. */
export const FECHA_DE_INICIO = "Fecha de inicio";
export const MES_DESDE_EL_QUE_LEEMOS = "Mes desde el que leemos";
