/* Modelo PURO del widget "Ciclo de caja" del Inicio (sin React → testeable). Responde, en lenguaje de
   dueño: ¿en cuántos días cobro?, ¿en cuántos pago?, ¿cuántos días queda mi plata atrapada?
   Fuente: /api/treasury/cash-cycle (DSO/DPO/CCC ya calculados por el backend — NO recalculamos). */

import type { CashCycleResponse } from "@/lib/api/treasury";
import { concordar } from "@/lib/formatters/count";

export interface CicloCaja {
  /** Días que tardo en COBRAR (DSO); `null` si no hay dato. */
  dso: number | null;
  /** Días que tardo en PAGAR (DPO); `null` si no hay dato. */
  dpo: number | null;
  /** Ciclo de conversión de caja = DSO − DPO; `null` si no hay dato. */
  ccc: number | null;
}

/** Deriva el ciclo de caja del `cash-cycle`. `null` si no vino ningún día (el contenedor degrada). */
export function mapCicloCaja(resp: CashCycleResponse | undefined): CicloCaja | null {
  if (!resp) return null;
  if (resp.dso_days == null && resp.dpo_days == null && resp.ccc_days == null) return null;
  return { dso: resp.dso_days, dpo: resp.dpo_days, ccc: resp.ccc_days };
}

export type CicloCajaTono = "neg" | "pos" | "neutral";

/** Frase en lenguaje de dueño según el signo del ciclo — PURA (issue #94: "Tu plata queda ~1
 * días atrapada" era el defecto vivo; DSO/DPO/CCC de 1 día es un caso real, no de laboratorio,
 * para una empresa que cobra/paga casi al contado). */
export function fraseCicloCaja(ccc: number | null): { frase: string; tono: CicloCajaTono } {
  if (ccc == null) {
    return {
      frase:
        "Cuando tengamos cobros y pagos con fecha, calculamos cuántos días queda tu plata atrapada.",
      tono: "neutral",
    };
  }
  if (ccc > 0) {
    return {
      frase: `Tu plata queda ~${ccc} ${concordar(ccc, "día", "días")} atrapada entre que pagas y cobras: financias ese tramo tú.`,
      tono: "neg",
    };
  }
  if (ccc < 0) {
    const dias = Math.abs(ccc);
    return {
      frase: `Cobras antes de pagar: tienes ~${dias} ${concordar(dias, "día", "días")} de aire (tus proveedores te financian).`,
      tono: "pos",
    };
  }
  return { frase: "Cobras y pagas casi al mismo ritmo.", tono: "neutral" };
}

export interface CicloCajaStat {
  label: string;
  valor: string;
  sufijo?: string;
}

/** Las tres filas (Cobras en / Pagas en / Ciclo) del widget — PURA. El sufijo "día"/"días" va
 * SEPARADO del valor (fila propia en el diseño), así que necesita su propia concordancia: no
 * alcanza con que `valor` sea correcto si el sufijo de al lado siempre dice "días" (issue #94,
 * el ejemplo literal "Cobras en 1 días" del reporte). */
export function statsCicloCaja(
  dso: number | null,
  dpo: number | null,
  ccc: number | null,
): [CicloCajaStat, CicloCajaStat, CicloCajaStat] {
  const valorDias = (v: number | null) => (v != null ? `${v}` : "Sin información");
  const sufijoDias = (v: number | null) =>
    v != null ? concordar(Math.abs(v), "día", "días") : undefined;
  return [
    { label: "Cobras en", valor: valorDias(dso), sufijo: sufijoDias(dso) },
    { label: "Pagas en", valor: valorDias(dpo), sufijo: sufijoDias(dpo) },
    { label: "Ciclo", valor: valorDias(ccc), sufijo: sufijoDias(ccc) },
  ];
}
