/* Progreso macro de una obligación / préstamo, derivado del calendario de cuotas.
   PURO (sin React, sin formato): la vista compone el Timeline con estos números.
   El FE no calcula finanzas (los montos vienen del backend); esto solo CUENTA
   estados de cuotas ya provistos y ubica próxima/última fecha. */

export interface ObligationInstallmentLike {
  number: number;
  due_date: string;
  status: string;
}

export interface ObligationProgress {
  /** Cuotas marcadas pagadas por el backend. */
  paidCount: number;
  /** Cuotas marcadas vencidas (impagas y con vencimiento pasado). */
  overdueCount: number;
  /** Total de cuotas del calendario. */
  total: number;
  /** Vencimiento (YYYY-MM-DD) de la próxima cuota impaga, o null si no queda ninguna. */
  nextDueDate: string | null;
  /** Vencimiento (YYYY-MM-DD) de la última cuota del calendario, o null. */
  payoffDate: string | null;
  /** true si todas las cuotas están pagadas. */
  settled: boolean;
}

function isPaid(status: string): boolean {
  const s = status.toLowerCase();
  return s === "paid" || s === "pagada";
}

function isOverdue(status: string): boolean {
  const s = status.toLowerCase();
  return s === "overdue" || s === "vencida";
}

export function computeObligationProgress(
  installments: ReadonlyArray<ObligationInstallmentLike>,
  installmentsTotal?: number,
): ObligationProgress {
  const total = installmentsTotal ?? installments.length;
  let paidCount = 0;
  let overdueCount = 0;
  let nextDueDate: string | null = null;
  let payoffDate: string | null = null;

  for (const c of installments) {
    if (isPaid(c.status)) {
      paidCount++;
    } else {
      if (isOverdue(c.status)) overdueCount++;
      // Próxima impaga = la de vencimiento más temprano.
      if (nextDueDate === null || c.due_date < nextDueDate) nextDueDate = c.due_date;
    }
    if (payoffDate === null || c.due_date > payoffDate) payoffDate = c.due_date;
  }

  return {
    paidCount,
    overdueCount,
    total,
    nextDueDate,
    payoffDate,
    // Sobre el total efectivo: un calendario parcial no cuenta como liquidado.
    settled: total > 0 && paidCount === total,
  };
}
