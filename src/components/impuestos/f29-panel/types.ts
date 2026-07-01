/* Tipos PROVISIONALES del panel anual de F29 (control de gestión).
 *
 * ⚠️ Prototipo: el endpoint `GET /api/sii/f29?anio=YYYY` todavía NO existe en
 * el backend (escalado a CC-API en STATE_OF_THE_TRAIN / qavante-api#408). Cuando
 * exista, estos tipos se REEMPLAZAN por los generados en `@/lib/api/types`
 * (regla 3: types.ts es generado, no hand-rolled). Acá viven aparte solo para
 * armar y validar la UX antes de que llegue el contrato real. */

export type F29Estado = "vigente" | "rectificatoria" | "con_observaciones" | "no_declarada";

export type F29EstadoPago = "pagado" | "pendiente" | "vencido" | "postergado" | "parcial";

/** Un tramo de IVA cuyo pago se postergó (postergación ProPyme) y cuándo vence. */
export interface F29PostergacionTramo {
  periodo: string; // YYYY-MM del F29 que originó la postergación
  monto: number;
  vence: string; // YYYY-MM-DD
}

/** Cuadratura del IVA débito del F29 contra la suma del Libro de Ventas (RCV). */
export interface F29CuadraturaRcv {
  iva_debito_rcv: number;
  difiere: boolean;
  delta: number; // f29 - rcv (con signo)
}

/** Una declaración mensual. Campos numéricos `| null`: entrega incremental —
 *  el backend puede mandar la fila con el detalle en null hasta parsearlo. */
export interface F29Declaracion {
  periodo: string; // YYYY-MM
  folio: number | null;
  estado: F29Estado;
  fecha_vencimiento: string; // YYYY-MM-DD
  estado_pago: F29EstadoPago;
  total_a_pagar: number | null;
  monto_pagado: number | null;
  iva_postergado: number | null;
  observaciones: string | null;
  iva_debito_fiscal: number | null;
  iva_credito_fiscal: number | null;
  ppm: number | null;
  remanente_credito_fiscal: number | null;
  cuadratura_rcv: F29CuadraturaRcv | null;
}

export interface F29ProximoVencimiento {
  periodo: string; // YYYY-MM
  fecha: string; // YYYY-MM-DD
  monto_estimado: number | null;
}

/** Agregados anuales — TODO calculado por el backend (regla §17.4: el FE no
 *  calcula finanzas, solo presenta). */
export interface F29Resumen {
  iva_neto_pagado_ytd: number | null;
  iva_neto_pagado_ytd_prev: number | null; // mismo período año anterior
  ppm_acumulado_ytd: number | null;
  remanente_credito_fiscal: number | null;
  remanente_tendencia: "subiendo" | "bajando" | "estable" | null;
  iva_postergado_pendiente: number | null;
  iva_postergado_tramos: F29PostergacionTramo[];
  proximo_vencimiento: F29ProximoVencimiento | null;
}

export interface F29TendenciaPunto {
  periodo: string; // YYYY-MM
  iva_debito: number | null;
  iva_credito: number | null;
  total_a_pagar: number | null;
}

export interface F29AnnualResponse {
  anio: number;
  resumen: F29Resumen;
  tendencia: F29TendenciaPunto[];
  declaraciones: F29Declaracion[];
}
