/* Modelo PURO de la cascada de caja (waterfall) — sin React → testeable. A diferencia de la
   cascada del RESULTADO (P&L, por categoría), la de caja es CRONOLÓGICA: cada movimiento cae en
   su fecha y mueve el saldo corriente. Deriva los pasos (con saldo antes/después) desde el saldo
   de hoy + los movimientos ordenados por fecha, y el piso (saldo corriente más bajo del camino).

   Contesta la 2ª mitad del hero ("¿qué puedo hacer?"): se ven las palancas — adelantar una
   cobranza o postergar un pago cambia el pozo. */

export type MovTipo = "cobranza" | "sueldos" | "proveedor" | "impuesto" | "otro";

export interface MovimientoCaja {
  /** Fecha real del movimiento (para ordenar cronológicamente). */
  fecha: Date;
  /** Etiqueta corta de la fecha para el eje (ej. "30-jul"). */
  fechaLabel: string;
  /** Nombre del movimiento (ej. "Sueldos", "Cobro Kaufmann"). */
  label: string;
  /** Monto con signo: `+` entra, `−` sale. */
  monto: number;
  tipo?: MovTipo;
}

export type PasoKind = "hoy" | "in" | "out" | "proyectado";

export interface PasoCascada {
  label: string;
  fechaLabel: string;
  /** Monto con signo del paso (0 en los anclas hoy/proyectado). */
  monto: number;
  kind: PasoKind;
  /** Saldo corriente ANTES de aplicar el paso. */
  saldoAntes: number;
  /** Saldo corriente DESPUÉS de aplicar el paso. */
  saldoDespues: number;
}

/** Construye los pasos de la cascada: ancla "hoy" + un paso por movimiento (ordenados por fecha,
 *  con el saldo corriente) + ancla "proyectado" (saldo final). PURO — no muta la entrada. */
export function construirCascada(
  saldoHoy: number,
  movimientos: MovimientoCaja[],
  labelProyectado = "Proyectado",
): PasoCascada[] {
  const ordenados = [...movimientos].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  const pasos: PasoCascada[] = [
    {
      label: "Saldo hoy",
      fechaLabel: "hoy",
      monto: 0,
      kind: "hoy",
      saldoAntes: saldoHoy,
      saldoDespues: saldoHoy,
    },
  ];
  let saldo = saldoHoy;
  for (const m of ordenados) {
    const antes = saldo;
    saldo += m.monto;
    pasos.push({
      label: m.label,
      fechaLabel: m.fechaLabel,
      monto: m.monto,
      kind: m.monto >= 0 ? "in" : "out",
      saldoAntes: antes,
      saldoDespues: saldo,
    });
  }
  pasos.push({
    label: labelProyectado,
    fechaLabel: "",
    monto: 0,
    kind: "proyectado",
    saldoAntes: saldo,
    saldoDespues: saldo,
  });
  return pasos;
}

/** Piso: el saldo corriente más bajo del camino (empate → el primero). `null` si no hay pasos. */
export function pisoCascada(pasos: PasoCascada[]): { saldo: number; indice: number } | null {
  if (pasos.length === 0) return null;
  let idx = 0;
  for (let i = 1; i < pasos.length; i++) {
    if ((pasos[i]?.saldoDespues ?? 0) < (pasos[idx]?.saldoDespues ?? 0)) idx = i;
  }
  return { saldo: pasos[idx]?.saldoDespues ?? 0, indice: idx };
}

/** Rango [min, max] del saldo corriente a lo largo de la cascada (incluye el $0 si el camino lo
 *  cruza, para que el eje muestre el rojo). Para encuadrar el gráfico. PURO. */
export function rangoCascada(pasos: PasoCascada[]): { min: number; max: number } {
  const vals = pasos.flatMap((p) => [p.saldoAntes, p.saldoDespues]);
  const min = Math.min(0, ...vals);
  const max = Math.max(0, ...vals);
  return { min, max };
}
