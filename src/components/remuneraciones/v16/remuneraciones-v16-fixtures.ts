/* Fixtures compartidas por los tests y las stories de V16 · Remuneraciones. Sólo datos: nada se
 * formatea acá (el lint del rediseño §5.8 corre sobre este archivo). Nombres y RUTs INVENTADOS
 * con la forma del contrato — nunca datos de un tenant real (regla de PII de la vista, issue
 * #77: "esta vista lista personas"). */

import type { PayrollTotales } from "@/lib/api/buk";
import type { EmployeePayroll } from "../payroll-detalle";

export const HOY = new Date("2026-08-30T15:00:00Z");
export const PERIODO = "2026-07";

/** Totales del período (BUK), forma normal: 5 personas con líquido, dotación completa. */
export function totales(over: Partial<PayrollTotales> = {}): PayrollTotales {
  return {
    total_haberes: 17_500_000,
    total_descuentos: 4_112_241,
    total_liquido: 13_387_759,
    total_imponible: 15_900_000,
    empleados_contados: 5,
    total_cotizaciones: 3_190_631,
    ...over,
  };
}

export const EMPLEADO_ROJAS: EmployeePayroll = {
  id: "e1",
  nombre: "Javiera Rojas Muñoz",
  rut: "11111111-1",
  haberes: 3_200_000,
  costoEmpresa: 3_950_000,
  liquido: 2_850_000,
};
export const EMPLEADO_SOTO: EmployeePayroll = {
  id: "e2",
  nombre: "Matías Soto Peña",
  rut: "22222222-2",
  haberes: 2_950_000,
  costoEmpresa: 3_640_000,
  liquido: 2_610_000,
};
export const EMPLEADO_NUNEZ: EmployeePayroll = {
  id: "e3",
  nombre: "Camila Núñez Vera",
  rut: "33333333-3",
  haberes: 2_580_000,
  costoEmpresa: 3_180_000,
  liquido: 2_245_500,
};
export const EMPLEADO_CONTRERAS: EmployeePayroll = {
  id: "e4",
  nombre: "Diego Contreras Lara",
  rut: "44444444-4",
  haberes: 2_610_000,
  costoEmpresa: 3_210_000,
  liquido: 2_281_259,
};
export const EMPLEADO_PIZARRO: EmployeePayroll = {
  id: "e5",
  nombre: "Fernanda Pizarro Díaz",
  rut: "55555555-5",
  haberes: 4_160_000,
  costoEmpresa: 5_010_000,
  liquido: 3_401_000,
};

/** Detalle por persona (owner-only, ADR-0057). Suma de líquido = 13.387.759, cuadra con
 *  `totales().total_liquido`. Suma de costoEmpresa = 18.990.000 — a propósito DISTINTA de
 *  líquido + cotizaciones (13.387.759 + 3.190.631 = 16.578.390): son dos números reales de dos
 *  fuentes, y la vista nunca debe confundirlos (ver el modelo, TRAMPA #1). */
export function detalle(over: EmployeePayroll[] | null = null): EmployeePayroll[] {
  return (
    over ?? [EMPLEADO_ROJAS, EMPLEADO_SOTO, EMPLEADO_NUNEZ, EMPLEADO_CONTRERAS, EMPLEADO_PIZARRO]
  );
}

/** Ingresos del período (`GET /api/management/operational-result`, campo `revenue`), para el %
 *  de ingresos de "Costo empresa". Costo empresa (18.990.000) / 38.900.000 ≈ 48,8%. */
export const REVENUE = 38_900_000;
