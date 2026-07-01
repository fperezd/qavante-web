/* Datos de ejemplo del Panel de KPIs del Libro (Storybook). No prod. */

import type { LibroDoc } from "./libro-kpis-format";

/** Ventas de junio con 2 clientes grandes + 1 nota de crédito. */
export const ventasDocs: LibroDoc[] = [
  { tipo_doc: 33, folio: 423, fecha: "24/06/2026", rut_contraparte: "76418976-0", razon_social: "Aguas de Antofagasta S.A.", monto_neto: 4610852, monto_iva: 876062, monto_total: 5486914 },
  { tipo_doc: 33, folio: 424, fecha: "24/06/2026", rut_contraparte: "96572360-9", razon_social: "Comercial Kaufmann S.A.", monto_neto: 4847515, monto_iva: 921028, monto_total: 5768543 },
  { tipo_doc: 33, folio: 425, fecha: "26/06/2026", rut_contraparte: "76418976-0", razon_social: "Aguas de Antofagasta S.A.", monto_neto: 1200000, monto_iva: 228000, monto_total: 1428000 },
  { tipo_doc: 39, folio: 426, fecha: "27/06/2026", rut_contraparte: "66666666-6", razon_social: "Boleta consumidor final", monto_neto: 420168, monto_iva: 79832, monto_total: 500000 },
  { tipo_doc: 61, folio: 61, fecha: "28/06/2026", rut_contraparte: "96572360-9", razon_social: "Comercial Kaufmann S.A.", monto_neto: 300000, monto_iva: 57000, monto_total: 357000 },
];

/** Compras de junio (IVA crédito es el número de oro para el F29). */
export const comprasDocs: LibroDoc[] = [
  { tipo_doc: 33, folio: 8891, fecha: "10/06/2026", rut_contraparte: "91234567-8", razon_social: "Distribuidora Andina Ltda.", monto_neto: 2100000, monto_iva: 399000, monto_total: 2499000 },
  { tipo_doc: 33, folio: 5521, fecha: "12/06/2026", rut_contraparte: "77555444-3", razon_social: "Proveedor Insumos SpA", monto_neto: 1400000, monto_iva: 266000, monto_total: 1666000 },
  { tipo_doc: 33, folio: 9012, fecha: "18/06/2026", rut_contraparte: "91234567-8", razon_social: "Distribuidora Andina Ltda.", monto_neto: 800000, monto_iva: 152000, monto_total: 952000 },
  { tipo_doc: 46, folio: 120, fecha: "20/06/2026", rut_contraparte: "76999888-7", razon_social: "Servicios Generales EIRL", monto_neto: 650000, monto_iva: 123500, monto_total: 773500 },
];
