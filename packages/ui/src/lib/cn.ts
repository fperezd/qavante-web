import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Une clases con merge inteligente de Tailwind (resuelve conflictos). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
