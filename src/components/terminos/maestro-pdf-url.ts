/**
 * La URL del PDF de un documento del maestro, segun la PANTALLA.
 *
 * Vive aparte del componente y no adentro porque es logica PURA, que es como el resto de este
 * directorio se organiza (`terminos-pago.ts` con las reglas, `maestro-view.tsx` con el render).
 * Y porque los tests de este repo no pueden importar de un `.tsx`: no hay transform de JSX
 * configurado, asi que una funcion pura escondida en un componente es una funcion sin test.
 */
import type { MaestroKind } from "./terminos-pago";
import { siiBhePdfUrl, siiDteEmitidoPdfUrl, siiDteRecibidoPdfUrl } from "@/lib/api/sii";

/** `YYYY-MM-DD` de una fecha local, sin pasar por UTC (que corre un dia en Chile). */
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * URL del PDF de un documento del maestro, SEGUN LA PANTALLA.
 *
 * Las tres vistas comparten este componente y cada una tiene su documento y su endpoint:
 *
 *   ventas       DTE emitido    lo dibuja el API desde el XML del respaldo
 *   compras      DTE recibido   idem
 *   honorarios   BHE            el PDF OFICIAL del SII, tal cual
 *
 * El RUT de la contraparte cambia de rol con la pantalla: en ventas es el RECEPTOR y en
 * compras/honorarios el EMISOR. Mandar el que no corresponde no da error — el filtro se
 * ignora y el SII devuelve otro documento del rango, que es peor que fallar.
 *
 * Los DTE se piden por RANGO (el endpoint los ubica por folio adentro) y la BHE por PERIODO.
 * Sin fecha de emision no hay ni rango ni periodo: devuelve `null` y `DteActions` pinta "s/d"
 * en vez de un boton que no puede funcionar.
 */
export function pdfUrlDeDoc(
  kind: MaestroKind,
  rutContraparte: string,
  d: { folio: number | string | null; fechaEmision: Date | null },
): string | null {
  const folio = Number(d.folio);
  if (!d.fechaEmision || !Number.isFinite(folio) || folio <= 0) return null;

  if (kind === "honorarios") {
    const periodo = `${d.fechaEmision.getFullYear()}-${String(d.fechaEmision.getMonth() + 1).padStart(2, "0")}`;
    return siiBhePdfUrl({ periodo, folio, rutEmisor: rutContraparte });
  }

  // Rango del MES de emision: el respaldo del SII trunca en rangos grandes, y el endpoint
  // ubica el folio adentro del rango que se le pase.
  const y = d.fechaEmision.getFullYear();
  const m = d.fechaEmision.getMonth();
  const desde = iso(new Date(y, m, 1));
  const hasta = iso(new Date(y, m + 1, 0));

  return kind === "ventas"
    ? siiDteEmitidoPdfUrl({ desde, hasta, folio, rutReceptor: rutContraparte })
    : siiDteRecibidoPdfUrl({ desde, hasta, folio, rutEmisor: rutContraparte });
}
