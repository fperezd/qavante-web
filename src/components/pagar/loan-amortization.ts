/* Amortización (sistema francés) — preview client-side del alta de préstamo.
   El backend deriva el calendario real al crear; esto es solo para que el usuario
   vea la cuota antes de enviar. Cuota constante:
       cuota = P · r / (1 − (1 + r)^−n)      (r = tasa mensual decimal)
   Con r = 0 (sin interés): cuota = P / n. */

export interface LoanPreview {
  /** Cuota mensual constante (CLP, redondeada). */
  monthlyPayment: number;
  /** Total a pagar (cuota × n). */
  totalToPay: number;
  /** Interés total (total − capital). */
  totalInterest: number;
}

/** Preview de la cuota para un préstamo francés. Devuelve `null` si los datos
 *  no permiten calcular (capital ≤ 0, cuotas ≤ 0, tasa negativa). */
export function loanPreview(
  principal: number,
  monthlyRate: number,
  installments: number,
  decimals = 0,
): LoanPreview | null {
  if (!(principal > 0) || !(installments > 0) || monthlyRate < 0) return null;

  const cuota =
    monthlyRate === 0
      ? principal / installments
      : (principal * monthlyRate) / (1 - (1 + monthlyRate) ** -installments);

  /* Se redondea con los decimales de la MONEDA. Redondear siempre al entero venía del
     supuesto de que todo era peso: una cuota de 129,03 UF se mostraba como 129, unos
     $19.000 de diferencia por cuota. */
  const factor = 10 ** decimals;
  const monthlyPayment = Math.round(cuota * factor) / factor;
  const totalToPay = Math.round(monthlyPayment * installments * factor) / factor;
  return {
    monthlyPayment,
    totalToPay,
    // El interés no puede ser negativo: con tasa 0 es exactamente 0; el resto sería el drift de
    // redondear la cuota (que lo absorbe la última cuota en el calendario real). Clamp a ≥ 0 para
    // no mostrar un "−$1" fantasma en préstamos sin interés.
    /* Se re-redondea con el mismo factor que los otros dos: es el único campo derivado de
       una resta entre floats, y sin esto salía 49.20440000000008 en UF. Hoy lo tapa el
       formateador, que corta en 0 o 2 decimales; mañana lo consume otra cosa. */
    totalInterest: Math.max(0, Math.round((totalToPay - principal) * factor) / factor),
  };
}

/** Tasa mensual IMPLÍCITA en una cuota: la inversa de `loanPreview`.
 *
 *  Un crédito real no llega con la tasa a la vista. Llega con gastos —comisión de
 *  apertura, impuesto DL 3475, seguros— que el acreedor ya metió adentro, así que lo
 *  único que el dueño sabe con certeza es cuánto le descuentan cada mes. Esta función
 *  resuelve la `r` que hace que la cuota francesa sea exactamente esa, y la `r` que
 *  devuelve es por eso la tasa EFECTIVA (con los gastos dentro), no la nominal del
 *  contrato: es la que corresponde para comparar créditos entre sí.
 *
 *  Se resuelve por bisección y no con una fórmula cerrada porque no existe: la ecuación
 *  P = C·(1 − (1+r)^−n)/r no se puede despejar en r. La cuota crece con la tasa de forma
 *  estrictamente monótona, así que bisecar converge siempre.
 *
 *  Devuelve `null` cuando no hay tasa que lo explique: cuota × n menor al capital (nadie
 *  presta a pérdida) o datos fuera de rango. Con cuota × n == capital la tasa es 0. */
export function monthlyRateFromPayment(
  principal: number,
  payment: number,
  installments: number,
): number | null {
  if (!(principal > 0) || !(payment > 0) || !(installments > 0)) return null;
  const total = payment * installments;
  // Devolver menos de lo prestado no tiene tasa ≥ 0 que lo explique.
  if (total < principal) return null;
  if (total === principal) return 0;

  // Cuota implicada por una tasa (la misma fórmula de `loanPreview`, sin redondear:
  // acá el redondeo introduciría escalones y la bisección se detendría en uno).
  const paymentAt = (r: number) =>
    r === 0 ? principal / installments : (principal * r) / (1 - (1 + r) ** -installments);

  // Cota superior: 0 → 1000 %/mes. Una cuota que ni ahí se alcanza no es un crédito.
  let lo = 0;
  let hi = 10;
  if (paymentAt(hi) < payment) return null;

  // 200 pasos dejan el intervalo muy por debajo de cualquier dígito que se muestre.
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (paymentAt(mid) < payment) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
