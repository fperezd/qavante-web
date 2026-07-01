/* Tipos de Cobrar v2 (prototipo de propuesta UX). Extiende el snapshot de
 * cuentas por cobrar actual con lo que un CFO necesita: DSO + tendencia,
 * proyección de cobranza semanal (cash-in) y priorización. Los campos nuevos
 * (dso, weekly_collection) requieren ampliar el contrato del backend; el resto
 * (priorización, concentración) se deriva FE-only de lo que ya llega. */

export interface CollectionWeek {
  /** Etiqueta ("Esta semana", "14 jul", …). */
  label: string;
  /** Monto esperado de cobro (string-decimal). */
  expected: string;
}

export interface CollectionItem {
  client_name: string;
  client_rut: string;
  /** Ej. "Factura 1234". */
  document: string;
  balance: string;
  /** Días de mora; negativo si aún no vence. */
  days_overdue: number;
  /** ISO date. */
  due_date: string;
}

export interface DebtorLine {
  name: string;
  rut: string;
  total: string;
  overdue: string;
}

export interface CobranzaV2Data {
  total: string;
  overdue: string;
  overdue_pct: string;
  /** Días de venta pendientes de cobro (DSO). */
  dso: number | null;
  dso_prev: number | null;
  /** Plazo objetivo de la política de crédito (días). */
  dso_target: number | null;
  /** Proyección de cobranza por semana (cash-in esperado). */
  weekly_collection: CollectionWeek[];
  /** Documentos a gestionar (se priorizan en el FE por saldo × mora). */
  items: CollectionItem[];
  top_debtors: DebtorLine[];
}
