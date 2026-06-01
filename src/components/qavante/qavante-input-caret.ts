/* Helpers puros para preservar la posición del caret cuando un input
   reformatea en vivo (variants currency/rut de QavanteInput). Sin React →
   testeables en vitest unit. La idea: el caret se ancla a la cantidad de
   caracteres "significativos" (los que sobreviven al formateo) antes de él,
   no a un índice absoluto que el reformateo invalida (#8). */

export type CaretVariant = "currency" | "rut";

/* Significativos = los chars que el formateo conserva. El resto son
   separadores que el formato agrega/quita ($, puntos, guion, espacios):
   - currency: solo dígitos.
   - rut: dígitos + dígito verificador K/k. */
function significantRe(variant: CaretVariant): RegExp {
  return variant === "currency" ? /[0-9]/ : /[0-9kK]/;
}

/** Cuántos chars significativos hay en `str` antes del índice `upto`. */
export function countSignificantBefore(variant: CaretVariant, str: string, upto: number): number {
  const re = significantRe(variant);
  const end = Math.max(0, Math.min(upto, str.length));
  let n = 0;
  for (let i = 0; i < end; i++) if (re.test(str[i]!)) n++;
  return n;
}

/** Índice de caret en `formatted` justo después del `count`-ésimo char
    significativo. Con `count<=0` → 0; si no alcanza, fin del string. */
export function caretAfterSignificant(
  variant: CaretVariant,
  formatted: string,
  count: number,
): number {
  if (count <= 0) return 0;
  const re = significantRe(variant);
  let n = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (re.test(formatted[i]!)) {
      n++;
      if (n === count) return i + 1;
    }
  }
  return formatted.length;
}

/** Nueva posición de caret tras reformatear: ancla por chars significativos.
    `rawValue`/`rawCaret` = lo que el usuario dejó (input crudo del onChange);
    `formatted` = el valor ya reformateado que se va a renderizar. */
export function preservedCaret(
  variant: CaretVariant,
  rawValue: string,
  rawCaret: number,
  formatted: string,
): number {
  const sig = countSignificantBefore(variant, rawValue, rawCaret);
  return caretAfterSignificant(variant, formatted, sig);
}
