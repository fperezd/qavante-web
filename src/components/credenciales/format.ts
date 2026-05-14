/* Helpers de formateo compartidos por los cards/dialogs de credenciales.
   Formato es-CL alineado con Anexo F (Voice & Tone). */

import { format, formatDistanceStrict, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

export function formatDateEsCL(iso: string): string {
  try {
    return format(new Date(iso), "d 'de' MMMM 'de' yyyy", { locale: es });
  } catch {
    return iso;
  }
}

export function formatDateShortEsCL(iso: string): string {
  try {
    return format(new Date(iso), "d MMM yyyy", { locale: es });
  } catch {
    return iso;
  }
}

export function daysUntil(iso: string): number {
  try {
    return differenceInDays(new Date(iso), new Date());
  } catch {
    return Infinity;
  }
}

export function distanceFromNowEsCL(iso: string): string {
  try {
    return formatDistanceStrict(new Date(iso), new Date(), { locale: es, addSuffix: false });
  } catch {
    return iso;
  }
}
