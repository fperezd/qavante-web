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
): LoanPreview | null {
  if (!(principal > 0) || !(installments > 0) || monthlyRate < 0) return null;

  const cuota =
    monthlyRate === 0
      ? principal / installments
      : (principal * monthlyRate) / (1 - (1 + monthlyRate) ** -installments);

  const monthlyPayment = Math.round(cuota);
  const totalToPay = monthlyPayment * installments;
  return {
    monthlyPayment,
    totalToPay,
    // El interés no puede ser negativo: con tasa 0 es exactamente 0; el resto sería el drift de
    // redondear la cuota (que lo absorbe la última cuota en el calendario real). Clamp a ≥ 0 para
    // no mostrar un "−$1" fantasma en préstamos sin interés.
    totalInterest: Math.max(0, totalToPay - principal),
  };
}
