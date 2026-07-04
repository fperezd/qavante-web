/* Patrón de tabla "premium" (Ola 2 · una sola tabla). El contenedor scrollea y
   el encabezado + la fila de total quedan FIJOS (sticky). En tablas largas (ej.
   el Libro con hasta 100 filas) esto evita perder el contexto de columnas y el
   agregado —el dato que el usuario vino a buscar— al hacer scroll, como en
   Mercury/Pennylane. Clases compartidas para aplicar el patrón consistente en
   todas las tablas.

   Uso:
     <div className={stickyScroll}>
       <table>
         <thead className={stickyHead}> … </thead>
         <tbody> … </tbody>
         <tfoot className={stickyFoot}> … total … </tfoot>
       </table>
     </div>

   Requisitos: el fondo sólido (bg-surface) va en el <thead>/<tfoot> para que las
   filas no se transparenten por detrás. El z mantiene el header/total por encima
   del cuerpo. */

/** Contenedor scrolleable (vertical + horizontal). El alto máximo dispara el
 *  scroll interno solo cuando el contenido excede ~70% del viewport. */
export const stickyScroll = "max-h-[70vh] overflow-auto";

/** Encabezado fijo al tope del contenedor. */
export const stickyHead = "sticky top-0 z-20 bg-surface";

/** Fila(s) de total fijas al fondo del contenedor. */
export const stickyFoot = "sticky bottom-0 z-20 bg-surface";
