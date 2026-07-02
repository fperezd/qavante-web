/* Datos de ejemplo del Libro con anuladas (Storybook). No prod.
 * Reproduce el Libro de Ventas de Tooxs, Julio 2026 (facturas + NC de anulación). */

import type { LibroDoc } from "./libro-anuladas-format";

export const ventasJulio: LibroDoc[] = [
  { tipo_doc: 33, folio: 429, fecha: "2026-07-02", rut_contraparte: "90209000-2", razon_social: "CIA INDUSTRIAL EL VOLCAN S A", monto_neto: 1837159, monto_iva: 349060, monto_total: 2186219 },
  { tipo_doc: 33, folio: 426, fecha: "2026-07-01", rut_contraparte: "76489841-9", razon_social: "CLINICA DE PUERTO VARAS SPA", monto_neto: 142881, monto_iva: 27147, monto_total: 170028 },
  { tipo_doc: 33, folio: 428, fecha: "2026-07-01", rut_contraparte: "76106531-9", razon_social: "GPS7000 SPA", monto_neto: 1241020, monto_iva: 235794, monto_total: 1476814 },
  { tipo_doc: 33, folio: 425, fecha: "2026-07-01", rut_contraparte: "76489841-9", razon_social: "CLINICA DE PUERTO VARAS SPA", monto_neto: 142881, monto_iva: 27147, monto_total: 170028 },
  { tipo_doc: 33, folio: 427, fecha: "2026-07-01", rut_contraparte: "76106531-9", razon_social: "GPS7000 SPA", monto_neto: 1241020, monto_iva: 235794, monto_total: 1476814 },
  { tipo_doc: 61, folio: 89, fecha: "2026-07-02", rut_contraparte: "76106531-9", razon_social: "GPS7000 SPA", monto_neto: 1241020, monto_iva: 235794, monto_total: 1476814 },
  { tipo_doc: 61, folio: 91, fecha: "2026-07-02", rut_contraparte: "76489841-9", razon_social: "CLINICA DE PUERTO VARAS SPA", monto_neto: 142881, monto_iva: 27147, monto_total: 170028 },
  { tipo_doc: 61, folio: 90, fecha: "2026-07-02", rut_contraparte: "76489841-9", razon_social: "CLINICA DE PUERTO VARAS SPA", monto_neto: 142881, monto_iva: 27147, monto_total: 170028 },
];

/** Caso simple 1:1 (como el modal de Chipax): factura Kaufmann anulada por su NC. */
export const ventasKaufmann: LibroDoc[] = [
  { tipo_doc: 33, folio: 418, fecha: "2026-06-10", rut_contraparte: "96572360-9", razon_social: "Comercial Kaufmann S.A.", monto_neto: 1210749, monto_iva: 230042, monto_total: 1440791 },
  { tipo_doc: 61, folio: 83, fecha: "2026-06-11", rut_contraparte: "96572360-9", razon_social: "Comercial Kaufmann S.A.", monto_neto: 1210749, monto_iva: 230042, monto_total: 1440791 },
  { tipo_doc: 33, folio: 411, fecha: "2026-06-10", rut_contraparte: "76114300-8", razon_social: "Matrix Consulting Limitada", monto_neto: 1712170, monto_iva: 325313, monto_total: 2037483 },
];
