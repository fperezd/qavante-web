/* Datos de ejemplo del panel F29 para Storybook y validación de UX.
 * NO se usan en producción — solo alimentan las stories mientras el endpoint
 * real (`GET /api/sii/f29?anio=YYYY`) no existe. */

import type { F29AnnualResponse, F29Declaracion } from "./types";

function d(over: Partial<F29Declaracion> & Pick<F29Declaracion, "periodo" | "fecha_vencimiento">): F29Declaracion {
  return {
    folio: null,
    estado: "vigente",
    estado_pago: "pendiente",
    total_a_pagar: null,
    monto_pagado: null,
    iva_postergado: null,
    observaciones: null,
    iva_debito_fiscal: null,
    iva_credito_fiscal: null,
    ppm: null,
    remanente_credito_fiscal: null,
    cuadratura_rcv: null,
    ...over,
  };
}

/* Año en curso (referencia: hoy ~30-06-2026). Enero–Abril pagados, Febrero con
   IVA postergado, Marzo con observaciones, Mayo vencido impago + descuadre vs
   Libro, Junio en adelante por declarar. */
export const f29Year2026: F29AnnualResponse = {
  anio: 2026,
  resumen: {
    iva_neto_pagado_ytd: 2540000,
    iva_neto_pagado_ytd_prev: 2270000,
    ppm_acumulado_ytd: 695000,
    remanente_credito_fiscal: 340000,
    remanente_tendencia: "subiendo",
    iva_postergado_pendiente: 140000,
    iva_postergado_tramos: [{ periodo: "2026-02", monto: 140000, vence: "2026-08-12" }],
    proximo_vencimiento: { periodo: "2026-06", fecha: "2026-07-12", monto_estimado: 690000 },
  },
  tendencia: [
    { periodo: "2026-01", iva_debito: 2480000, iva_credito: 1770000, total_a_pagar: 710000 },
    { periodo: "2026-02", iva_debito: 2100000, iva_credito: 1560000, total_a_pagar: 540000 },
    { periodo: "2026-03", iva_debito: 2760000, iva_credito: 1940000, total_a_pagar: 820000 },
    { periodo: "2026-04", iva_debito: 2310000, iva_credito: 1700000, total_a_pagar: 610000 },
    { periodo: "2026-05", iva_debito: 2500000, iva_credito: 1790000, total_a_pagar: 710000 },
    { periodo: "2026-06", iva_debito: 2050000, iva_credito: 1620000, total_a_pagar: 430000 },
  ],
  declaraciones: [
    d({
      periodo: "2026-01", fecha_vencimiento: "2026-02-12", folio: 8412350021,
      estado_pago: "pagado", total_a_pagar: 710000, monto_pagado: 710000,
      iva_debito_fiscal: 2480000, iva_credito_fiscal: 1770000, ppm: 140000,
      remanente_credito_fiscal: 0,
      cuadratura_rcv: { iva_debito_rcv: 2480000, difiere: false, delta: 0 },
    }),
    d({
      periodo: "2026-02", fecha_vencimiento: "2026-03-12", folio: 8455120088,
      estado_pago: "postergado", total_a_pagar: 540000, monto_pagado: 400000, iva_postergado: 140000,
      iva_debito_fiscal: 2100000, iva_credito_fiscal: 1560000, ppm: 130000,
      remanente_credito_fiscal: 0,
      cuadratura_rcv: { iva_debito_rcv: 2100000, difiere: false, delta: 0 },
    }),
    d({
      periodo: "2026-03", fecha_vencimiento: "2026-04-12", folio: 8501993412,
      estado: "con_observaciones", estado_pago: "pagado", total_a_pagar: 820000, monto_pagado: 820000,
      iva_debito_fiscal: 2760000, iva_credito_fiscal: 1940000, ppm: 150000, remanente_credito_fiscal: 0,
      observaciones: "El SII observó el código 538 (IVA crédito). Revísalo con tu contador antes de que venza el plazo de corrección.",
      cuadratura_rcv: { iva_debito_rcv: 2760000, difiere: false, delta: 0 },
    }),
    d({
      periodo: "2026-04", fecha_vencimiento: "2026-05-12", folio: 8548220751,
      estado_pago: "pagado", total_a_pagar: 610000, monto_pagado: 610000,
      iva_debito_fiscal: 2310000, iva_credito_fiscal: 1700000, ppm: 135000, remanente_credito_fiscal: 0,
      cuadratura_rcv: { iva_debito_rcv: 2310000, difiere: false, delta: 0 },
    }),
    d({
      periodo: "2026-05", fecha_vencimiento: "2026-06-12", folio: 8590114233,
      estado_pago: "vencido", total_a_pagar: 710000, monto_pagado: 0,
      iva_debito_fiscal: 2500000, iva_credito_fiscal: 1790000, ppm: 140000, remanente_credito_fiscal: 0,
      cuadratura_rcv: { iva_debito_rcv: 2580000, difiere: true, delta: -80000 },
    }),
    d({ periodo: "2026-06", fecha_vencimiento: "2026-07-12", estado: "no_declarada", estado_pago: "pendiente" }),
    d({ periodo: "2026-07", fecha_vencimiento: "2026-08-12", estado: "no_declarada", estado_pago: "pendiente" }),
    d({ periodo: "2026-08", fecha_vencimiento: "2026-09-12", estado: "no_declarada", estado_pago: "pendiente" }),
  ],
};

/* Variante "todo al día": Mayo pagado y cuadrado → sin rojos, se ve el banner
   de próximo vencimiento en vez de la alerta de vencidos. */
export const f29Year2026AlDia: F29AnnualResponse = {
  ...f29Year2026,
  resumen: { ...f29Year2026.resumen, iva_neto_pagado_ytd: 3250000 },
  declaraciones: f29Year2026.declaraciones.map((decl) =>
    decl.periodo === "2026-05"
      ? {
          ...decl,
          estado_pago: "pagado",
          monto_pagado: 710000,
          cuadratura_rcv: { iva_debito_rcv: 2500000, difiere: false, delta: 0 },
        }
      : decl,
  ),
};

/* Entrega incremental: el backend manda el semáforo pero todavía no parseó los
   montos ni los agregados (todo null). El panel degrada con "—" sin romperse. */
export const f29Year2026Incremental: F29AnnualResponse = {
  anio: 2026,
  resumen: {
    iva_neto_pagado_ytd: null,
    iva_neto_pagado_ytd_prev: null,
    ppm_acumulado_ytd: null,
    remanente_credito_fiscal: null,
    remanente_tendencia: null,
    iva_postergado_pendiente: null,
    iva_postergado_tramos: [],
    proximo_vencimiento: { periodo: "2026-06", fecha: "2026-07-12", monto_estimado: null },
  },
  tendencia: f29Year2026.tendencia.map((p) => ({
    periodo: p.periodo,
    iva_debito: null,
    iva_credito: null,
    total_a_pagar: null,
  })),
  declaraciones: f29Year2026.declaraciones.map((decl) => ({
    ...decl,
    total_a_pagar: null,
    monto_pagado: null,
    iva_postergado: null,
    iva_debito_fiscal: null,
    iva_credito_fiscal: null,
    ppm: null,
    remanente_credito_fiscal: null,
    cuadratura_rcv: null,
  })),
};

/* Año anterior (para el selector): todo cerrado y pagado. */
export const f29Year2025: F29AnnualResponse = {
  anio: 2025,
  resumen: {
    iva_neto_pagado_ytd: 7180000,
    iva_neto_pagado_ytd_prev: 6640000,
    ppm_acumulado_ytd: 1620000,
    remanente_credito_fiscal: 120000,
    remanente_tendencia: "estable",
    iva_postergado_pendiente: 0,
    iva_postergado_tramos: [],
    proximo_vencimiento: null,
  },
  tendencia: [
    { periodo: "2025-09", iva_debito: 2200000, iva_credito: 1600000, total_a_pagar: 600000 },
    { periodo: "2025-10", iva_debito: 2400000, iva_credito: 1700000, total_a_pagar: 700000 },
    { periodo: "2025-11", iva_debito: 2600000, iva_credito: 1850000, total_a_pagar: 750000 },
    { periodo: "2025-12", iva_debito: 3100000, iva_credito: 2050000, total_a_pagar: 1050000 },
  ],
  declaraciones: [
    d({
      periodo: "2025-11", fecha_vencimiento: "2025-12-12", folio: 8210044120,
      estado_pago: "pagado", total_a_pagar: 750000, monto_pagado: 750000,
      iva_debito_fiscal: 2600000, iva_credito_fiscal: 1850000, ppm: 150000, remanente_credito_fiscal: 120000,
      cuadratura_rcv: { iva_debito_rcv: 2600000, difiere: false, delta: 0 },
    }),
    d({
      periodo: "2025-12", fecha_vencimiento: "2026-01-12", folio: 8258871003,
      estado_pago: "pagado", total_a_pagar: 1050000, monto_pagado: 1050000,
      iva_debito_fiscal: 3100000, iva_credito_fiscal: 2050000, ppm: 180000, remanente_credito_fiscal: 120000,
      cuadratura_rcv: { iva_debito_rcv: 3100000, difiere: false, delta: 0 },
    }),
  ],
};
