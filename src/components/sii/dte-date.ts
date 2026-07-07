/* Helpers de fecha para armar las URLs de PDF de DTE. PURO/testeable. El SII
   entrega fechas como `DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY` o `YYYY-MM-DD…`. */

/** Normaliza a `YYYY-MM-DD`, o `null` si no parsea o el mes/día está fuera de
 *  rango (p. ej. `32/13/2026` → null, para no armar una ventana de PDF absurda). */
export function toIsoDate(fecha?: string | null): string | null {
  if (!fecha) return null;
  const s = fecha.trim();
  let y: string | undefined, mo: string | undefined, d: string | undefined;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    [, y, mo, d] = iso;
  } else {
    const m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/);
    if (!m) return null;
    [, d, mo, y] = m;
  }
  if (!y || !mo || !d) return null;
  const mn = Number(mo);
  const dn = Number(d);
  if (mn < 1 || mn > 12 || dn < 1 || dn > 31) return null;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** `YYYY-MM` de una fecha (para el `periodo` del PDF de BHE), o `null`. */
export function fechaToPeriodo(fecha?: string | null): string | null {
  const iso = toIsoDate(fecha);
  return iso ? iso.slice(0, 7) : null;
}

/** Primer y último día del mes de `fecha` (`{desde, hasta}` en `YYYY-MM-DD`), o
 *  `null`. Se usa como ventana del PDF de DTE recibido: tolera que la fecha
 *  mostrada (recepción) no sea exactamente la de emisión, mientras caigan en el
 *  mismo mes. */
export function monthBounds(fecha?: string | null): { desde: string; hasta: string } | null {
  const iso = toIsoDate(fecha);
  if (!iso) return null;
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return null;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { desde: `${y}-${mm}-01`, hasta: `${y}-${mm}-${String(lastDay).padStart(2, "0")}` };
}

/** Ventana `{desde, hasta}` (YYYY-MM-DD) para el PDF de un DTE a partir del
 *  `period` del Libro. Acepta un rango `YYYY-MM_YYYY-MM` (primer día del primer
 *  mes → último día del último) o un mes suelto `YYYY-MM`. Se usa el RANGO
 *  COMPLETO seleccionado —no el mes de emisión de la fila— porque el endpoint
 *  ubica el folio dentro de la ventana: una factura emitida un mes y registrada
 *  en el RCV de otro (p. ej. emitida 30/01 y recibida en feb) no se encontraría
 *  si consultáramos solo su mes de emisión. `null` si no parsea. */
export function periodToPdfWindow(period?: string | null): { desde: string; hasta: string } | null {
  if (!period) return null;
  const [a, b] = period.split("_");
  const p1 = monthBounds(`${a}-01`);
  const p2 = monthBounds(`${b ?? a}-01`);
  if (!p1 || !p2) return null;
  // Ordenar por si el rango viene invertido (desde > hasta): la ventana del PDF
  // debe tener desde <= hasta o el SII no la resuelve.
  const [start, end] = p1.desde <= p2.desde ? [p1, p2] : [p2, p1];
  return { desde: start.desde, hasta: end.hasta };
}
