/* Datos de ejemplo de Pagar v2 (Storybook). No prod. */

import type { PagarV2Data } from "./types";

/** Caja apretada: hay vencidos y la caja NO cubre lo crítico a 14 días. */
export const pagarApretado: PagarV2Data = {
  total: "23400000",
  projected_cash_14d: "5000000",
  critical_obligations_14d: "7300000",
  items: [
    { label: "IVA F29 junio", supplier: "Tesorería General (SII)", category: "impuestos", amount: "2480000", days_to_due: 11, criticality: "critica", due_date: "2026-07-12" },
    { label: "Sueldos julio", supplier: "Remuneraciones", category: "sueldos", amount: "4200000", days_to_due: 4, criticality: "critica", due_date: "2026-07-05" },
    { label: "Factura 8891 — insumos", supplier: "Distribuidora Andina Ltda.", category: "proveedor", amount: "1850000", days_to_due: -6, criticality: "media", due_date: "2026-06-25" },
    { label: "Factura 8834 — servicios", supplier: "Distribuidora Andina Ltda.", category: "proveedor", amount: "980000", days_to_due: -18, criticality: "media", due_date: "2026-06-13" },
    { label: "Arriendo oficina", supplier: "Inmobiliaria Norte S.A.", category: "arriendo", amount: "1600000", days_to_due: 9, criticality: "media", due_date: "2026-07-10" },
    { label: "Cuota leasing camioneta", supplier: "Banco BICE", category: "leasing", amount: "740000", days_to_due: 20, criticality: "baja", due_date: "2026-07-21" },
    { label: "Factura 512 — marketing", supplier: "Agencia Creativa SpA", category: "proveedor", amount: "1350000", days_to_due: 26, criticality: "baja", due_date: "2026-07-27" },
    { label: "Cuota préstamo capital", supplier: "Banco BICE", category: "deuda", amount: "2100000", days_to_due: 14, criticality: "media", due_date: "2026-07-15" },
  ],
};

/** Caja holgada: sin vencidos, cubre lo crítico. */
export const pagarHolgado: PagarV2Data = {
  total: "9800000",
  projected_cash_14d: "18000000",
  critical_obligations_14d: "6600000",
  items: [
    { label: "IVA F29 junio", supplier: "Tesorería General (SII)", category: "impuestos", amount: "2480000", days_to_due: 11, criticality: "critica", due_date: "2026-07-12" },
    { label: "Sueldos julio", supplier: "Remuneraciones", category: "sueldos", amount: "4120000", days_to_due: 4, criticality: "critica", due_date: "2026-07-05" },
    { label: "Arriendo oficina", supplier: "Inmobiliaria Norte S.A.", category: "arriendo", amount: "1600000", days_to_due: 9, criticality: "media", due_date: "2026-07-10" },
    { label: "Factura 640 — insumos", supplier: "Distribuidora Andina Ltda.", category: "proveedor", amount: "1600000", days_to_due: 22, criticality: "baja", due_date: "2026-07-23" },
  ],
};
