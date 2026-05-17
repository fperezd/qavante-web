/* Fixtures SOLO para Storybook — no es contrato ni se importa en runtime app.
 *
 * Fundadas en el contrato VIVO verificado 2026-05-16 (reconciliation P4-4):
 * `GET /api/treasury/canonical-categories` expone la taxonomía §11 de 26
 * valores con `label` humano (schema `CanonicalCategoryMeta`). Acá hay un
 * subconjunto representativo (codes + labels + dirección reales de §11/Tabla
 * 7) para alimentar las stories. La lista completa la trae el backend; el FE
 * nunca la hardcodea en la app. */

import type {
  CanonicalCategoryOption,
  DimensionValueOption,
  ManagementAccountOption,
} from "./types";

export const CANONICAL_CATEGORIES_FIXTURE: CanonicalCategoryOption[] = [
  {
    code: "client_collection",
    label: "Cobro de cliente",
    description: "Entrada de caja de cliente o deudor comercial.",
    expectedDirection: "credit",
  },
  {
    code: "card_processor_settlement",
    label: "Abono procesador de pago",
    description: "Abono desde Transbank, MercadoPago, Getnet, Klap u otro procesador.",
    expectedDirection: "credit",
  },
  {
    code: "supplier_payment",
    label: "Pago a proveedor",
    description: "Pago comercial u operacional a proveedor.",
    expectedDirection: "debit",
  },
  {
    code: "payroll_payment",
    label: "Pago de remuneraciones",
    description: "Pago de sueldos, anticipos, finiquitos o nómina.",
    expectedDirection: "debit",
  },
  {
    code: "tax_payment",
    label: "Pago de impuestos",
    description: "IVA, PPM, renta u otro impuesto.",
    expectedDirection: "debit",
  },
  {
    code: "bank_fee",
    label: "Comisión bancaria",
    description: "Cargo bancario, mantención o comisión.",
    expectedDirection: "debit",
  },
  {
    code: "debt_service",
    label: "Pago de deuda",
    description: "Pago de cuota, leasing, amortización o deuda.",
    expectedDirection: "debit",
  },
  {
    code: "internal_bank_transfer",
    label: "Transferencia entre cuentas propias",
    description: "Movimiento entre cuentas de la misma empresa.",
    expectedDirection: "any",
  },
  {
    code: "capex_payment",
    label: "Pago CAPEX",
    description: "Compra de activo fijo, maquinaria, vehículo, tecnología o infraestructura.",
    expectedDirection: "debit",
  },
  {
    code: "unknown",
    label: "Por clasificar",
    description: "Movimiento sin clasificación suficiente.",
    expectedDirection: "any",
  },
];

export const MANAGEMENT_ACCOUNTS_FIXTURE: ManagementAccountOption[] = [
  { id: "1", displayName: "Ingresos operacionales", level: 0 },
  { id: "1.1", displayName: "Ventas de productos", level: 1 },
  { id: "1.2", displayName: "Ventas de servicios", level: 1 },
  { id: "2", displayName: "Costos operacionales", level: 0 },
  { id: "2.1", displayName: "Costo de materiales", level: 1 },
  { id: "3", displayName: "Gastos de administración", level: 0 },
  { id: "3.1", displayName: "Software y tecnología", level: 1 },
  { id: "3.2", displayName: "Categoría histórica (inactiva)", level: 1, selectable: false },
];

export const DIMENSION_VALUES_FIXTURE: DimensionValueOption[] = [
  { id: "p1", label: "Proyecto Alfa", level: 0 },
  { id: "p1a", label: "Fase 1", level: 1 },
  { id: "p1b", label: "Fase 2", level: 1 },
  { id: "p2", label: "Proyecto Beta", level: 0 },
  { id: "p3", label: "Proyecto Gamma", level: 0 },
];
