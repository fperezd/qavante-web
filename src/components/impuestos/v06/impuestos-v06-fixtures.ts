/* Fixtures compartidas por los tests y las stories de V06 · Impuestos. Sólo datos: nada se
 * formatea acá. Montos y folios INVENTADOS con la forma del contrato — nunca datos de un tenant
 * real (regla de PII, issue #73). La forma sí está verificada contra producción (ver la cabecera de
 * `impuestos-v06-model.ts`): campos exactos de `/f29/estado`, `/tgr/movimientos-deudas`,
 * `/buk/payroll`. */

import type { F29EstadoMes, F29ImpuestoResponse } from "@/lib/api/sii";
import type { TgrMovimiento } from "@/lib/api/tgr";

/** Referencia fija de "hoy": 15 de agosto de 2026, a mitad de mes para que el F-29 de julio (vence
 *  el 12 de agosto) esté claramente vencido y el de agosto esté claramente en curso. */
export const HOY_V06 = new Date(2026, 7, 15);

export const PERIODO_ACTUAL_V06 = "2026-08";

/** Ventana de 6 meses (marzo a agosto 2026) con un caso de cada estado real del `/f29/estado`:
 *  declarado (marzo), declarado con IVA postergado (abril), declarado sin monto parseado (junio,
 *  `saldo: null` ≠ $0), vencido sin declarar (julio) y en curso (agosto, el mes corriente). */
export function mesesF29V06(): F29EstadoMes[] {
  return [
    {
      mes: 3,
      periodo: "2026-03",
      estado: "declarado",
      declarado: true,
      folio: 1000001,
      saldo: 850000,
      remanente: 0,
      vencimiento: "2026-04-12",
    },
    {
      mes: 4,
      periodo: "2026-04",
      estado: "declarado",
      declarado: true,
      folio: 1000002,
      saldo: 920000,
      remanente: 0,
      vencimiento: "2026-05-12",
      postergado_iva: true,
      monto_postergado: 300000,
      vencimiento_postergado: "2026-07-20",
    },
    {
      mes: 5,
      periodo: "2026-05",
      estado: "declarado",
      declarado: true,
      folio: 1000003,
      saldo: 780000,
      remanente: 0,
      vencimiento: "2026-06-12",
    },
    {
      mes: 6,
      periodo: "2026-06",
      estado: "declarado",
      declarado: true,
      folio: 1000004,
      saldo: null, // declarado, monto no parseado — NO es $0
      remanente: null,
      vencimiento: "2026-07-12",
    },
    {
      mes: 7,
      periodo: "2026-07",
      estado: "no_declarado_vencido",
      declarado: false,
      folio: null,
      saldo: null,
      remanente: null,
      vencimiento: "2026-08-12", // vencido: 3 días antes de HOY_V06
    },
    {
      mes: 8,
      periodo: "2026-08",
      estado: "en_curso",
      declarado: false,
      folio: null,
      saldo: null,
      remanente: null,
      vencimiento: "2026-09-12",
    },
  ];
}

/** Variante sin ningún vencido — para la story/test de "cero rojo" (Ley 2). */
export function mesesF29SinVencidosV06(): F29EstadoMes[] {
  return mesesF29V06().map((m) =>
    m.periodo === "2026-07"
      ? { ...m, estado: "declarado" as const, declarado: true, folio: 1000005, saldo: 690000 }
      : m,
  );
}

export const PREVIRED_TOTALES_V06 = { totalCotizaciones: 612000, empleados: 9 };

export const F29_IMPUESTO_ESTIMABLE_V06: F29ImpuestoResponse = {
  status: "ok",
  periodo: PERIODO_ACTUAL_V06,
  declarado: false,
  derivado: true,
  estimable: true,
  incompleto: false,
  missing_inputs: [],
  as_of: "2026-08-15T12:30:00Z",
  input_sources: {
    rcv: {
      source: "sii_rcv",
      provenance: "rcv",
      freshness: "fresh",
      last_synced_at: "2026-08-15T12:00:00Z",
    },
    impuesto_trabajadores: {
      source: "buk",
      provenance: "buk_cache",
      freshness: "fresh",
      last_synced_at: "2026-08-15T11:00:00Z",
    },
  },
  iva_debito: 900000,
  iva_credito: 500000,
  remanente: 50000,
  ppm: 130000,
  impuesto_trabajadores: 50000,
  fuente_impuesto_trabajadores: "buk",
  impuesto_trabajadores_cached: true,
  impuesto_trabajadores_stale: false,
  iva_determinado: 350000,
  iva_postergable: 350000,
  iva_postergado: 0,
  total_con_iva: 530000,
  total_sin_iva: 180000,
};

export const F29_IMPUESTO_NO_ESTIMABLE_V06: F29ImpuestoResponse = {
  ...F29_IMPUESTO_ESTIMABLE_V06,
  estimable: false,
  missing_inputs: ["remanente", "impuesto_trabajadores"],
  remanente: null,
  impuesto_trabajadores: null,
  iva_debito: null,
  iva_credito: null,
  iva_determinado: null,
  iva_postergable: null,
  iva_postergado: null,
  ppm: null,
  total_con_iva: null,
  total_sin_iva: null,
};

export function tgrMovimientosV06(): TgrMovimiento[] {
  return [
    {
      rut_contribuyente: "76123456-7",
      formulario: "29",
      folio: "55231",
      fecha_vencimiento: "2026-07-20",
      moneda: "CLP",
      saldo: 430000,
      estado: "pendiente",
    },
    {
      rut_contribuyente: "76123456-7",
      formulario: "21",
      folio: "55240",
      fecha_vencimiento: "2026-08-05",
      moneda: "CLP",
      saldo: 95000,
      estado: "pendiente",
    },
  ];
}
