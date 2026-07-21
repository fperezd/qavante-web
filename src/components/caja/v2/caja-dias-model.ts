/* Modelo PURO del "medidor de días de caja" (sin React → testeable). Deriva, a partir de la
   serie de saldo proyectado (la misma de `caja-curva-model`) + la caja mínima, las respuestas
   que el medidor muestra: cuántos días te alcanza la caja hasta tocar la mínima / el $0, el piso
   (saldo más bajo y a cuántos días), y cuándo te recuperás. Interpola los tramos (semanales por
   default) a DÍAS, que es como el dueño lee "¿me alcanza?".

   El primer punto de la serie es "hoy" (día 0). `diasPorPunto` es el ancho del bucket: 7 semanal,
   ~30 mensual, 1 diario. */

import type { SaldoPunto } from "./caja-curva-model";

export type EstadoCaja = "sano" | "ajustado" | "critico";

export interface DiasCaja {
  /** Saldo de hoy (primer punto de la serie). */
  saldoHoy: number;
  /** Días hasta que la caja cae bajo la mínima. `0` si ya está por debajo hoy; `null` si nunca
   *  cruza dentro del horizonte de la serie. Es el "te alcanza X días". */
  diasHastaMinimo: number | null;
  /** Días hasta que la caja cae bajo $0 (entra en rojo). Mismo criterio. */
  diasHastaCero: number | null;
  /** Saldo más bajo de la serie y a cuántos días de hoy ocurre. */
  piso: { saldo: number; dia: number } | null;
  /** Días hasta volver ≥ mínima DESPUÉS del piso; `null` si no se recupera en el horizonte. */
  diasRecuperacion: number | null;
  /** Días totales que cubre la serie (horizonte de la proyección). */
  horizonteDias: number;
  /** `critico` si toca $0 · `ajustado` si toca la mínima sin caer bajo $0 · `sano` si nunca. */
  estado: EstadoCaja;
}

/** Días (desde hoy) hasta el PRIMER punto en que el saldo cae ESTRICTAMENTE bajo `umbral`,
 *  interpolando linealmente dentro del tramo que lo cruza. `0` si ya está por debajo en hoy;
 *  `null` si nunca lo cruza en la serie. PURO. */
export function cruceDias(
  serie: SaldoPunto[],
  umbral: number,
  diasPorPunto: number,
): number | null {
  if (serie.length === 0) return null;
  if ((serie[0]?.saldo ?? 0) < umbral) return 0; // ya bajo el umbral hoy
  for (let i = 1; i < serie.length; i++) {
    const a = serie[i - 1]?.saldo ?? 0;
    const b = serie[i]?.saldo ?? 0;
    if (b < umbral && a >= umbral) {
      const t = a === b ? 0 : (a - umbral) / (a - b); // fracción [0,1] del tramo
      return Math.max(0, (i - 1 + t) * diasPorPunto);
    }
  }
  return null;
}

/** Índice del saldo más bajo (empate → el primero). `null` si la serie está vacía. */
function indicePiso(serie: SaldoPunto[]): number | null {
  if (serie.length === 0) return null;
  let idx = 0;
  for (let i = 1; i < serie.length; i++) {
    if ((serie[i]?.saldo ?? 0) < (serie[idx]?.saldo ?? 0)) idx = i;
  }
  return idx;
}

/** Deriva las métricas del medidor. `null` si no hay ≥2 puntos (sin curva no hay proyección).
 *  `minimo` null → la referencia es $0 (sin mínima configurada, el piso relevante es el rojo). */
export function diasDeCaja(
  serie: SaldoPunto[],
  minimo: number | null,
  diasPorPunto = 7,
): DiasCaja | null {
  if (serie.length < 2) return null;
  const saldoHoy = serie[0]?.saldo ?? 0;
  const ref = minimo ?? 0;
  const diasHastaMinimo = cruceDias(serie, ref, diasPorPunto);
  const diasHastaCero = cruceDias(serie, 0, diasPorPunto);

  const pIdx = indicePiso(serie);
  const piso = pIdx == null ? null : { saldo: serie[pIdx]?.saldo ?? 0, dia: pIdx * diasPorPunto };

  let diasRecuperacion: number | null = null;
  if (pIdx != null) {
    for (let i = pIdx + 1; i < serie.length; i++) {
      if ((serie[i]?.saldo ?? 0) >= ref) {
        diasRecuperacion = i * diasPorPunto;
        break;
      }
    }
  }

  const tocaCero = diasHastaCero != null || saldoHoy < 0;
  const tocaMinimo = diasHastaMinimo != null || saldoHoy < ref;
  const estado: EstadoCaja = tocaCero ? "critico" : tocaMinimo ? "ajustado" : "sano";

  return {
    saldoHoy,
    diasHastaMinimo,
    diasHastaCero,
    piso,
    diasRecuperacion,
    horizonteDias: (serie.length - 1) * diasPorPunto,
    estado,
  };
}

/** ¿Hay dato suficiente para proyectar con honestidad? Necesitamos ≥3 puntos reales y algún
 *  movimiento material — si el banco casi no sincronizó, NO dibujamos una curva de confianza
 *  sobre 2 datos (mostramos el estado honesto). `movimientoAbsoluto` = Σ|netos| del período. */
export function datosSuficientes(serie: SaldoPunto[], movimientoAbsoluto: number): boolean {
  return serie.length >= 3 && movimientoAbsoluto > 0;
}

/** El valor que muestra la aguja: los días que "te alcanza" hasta la mínima. Si nunca la toca en
 *  el horizonte, la aguja llega al tope (caja sana). Acotado a `[0, max]`. PURO. */
export function diasParaAguja(m: DiasCaja, max: number): number {
  const d = m.diasHastaMinimo ?? m.horizonteDias;
  return Math.max(0, Math.min(max, d));
}
