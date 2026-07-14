/* Modelo PURO de la cascada del resultado (waterfall) de Gestión v2 (sin React → testeable).
   Convierte la secuencia del P&L (Ingresos → −Costos → Margen bruto → −Gastos → Resultado)
   en barras flotantes: cada resta arranca donde termina el acumulado anterior. Deriva la
   posición (left) y el largo (width) de cada barra como % del monto mayor (los ingresos).

   Todo se calcula desde el contrato `OperationalResultResponse` que ya existe (revenue,
   direct_cost, gross_margin, labor_cost, professional_fees, recurring_expenses, result);
   no inventa datos. Montos en CLP (números; el string-decimal se parsea antes). */

export type CascadaTipo = "ingreso" | "resta" | "subtotal" | "resultado";

export interface CascadaEntrada {
  id: string;
  label: string;
  tipo: CascadaTipo;
  /** Monto en CLP. Para `resta` es la magnitud (positiva) que se descuenta; para
   *  `subtotal`/`resultado` se ignora (el valor se deriva del acumulado). */
  monto: number;
  /** % opcional para un pill (ej. margen bruto como % de ingresos). */
  pct?: number;
  onClick?: () => void;
}

export interface CascadaBarra extends CascadaEntrada {
  /** Monto a mostrar, firmado: las restas van en negativo; subtotal/resultado = acumulado. */
  montoFirmado: number;
  /** Acumulado (running total) en ese punto. */
  acumulado: number;
  /** Inicio de la barra, % [0..100]. */
  left: number;
  /** Largo de la barra, % [0..100] (mínimo 0.8 para que un ítem chico igual se vea). */
  width: number;
  /** Acumulado negativo (pérdida) → la barra de resultado/subtotal se pinta en rojo. */
  negativo: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Calcula las barras flotantes de la cascada a partir de la secuencia del P&L. */
export function computeCascada(entradas: CascadaEntrada[]): CascadaBarra[] {
  // Paso 1: trayectoria del acumulado en unidades crudas (start/end de cada barra).
  let running = 0;
  const raw = entradas.map((e) => {
    let start: number;
    let end: number;
    if (e.tipo === "ingreso") {
      start = running;
      running += e.monto;
      end = running;
    } else if (e.tipo === "resta") {
      end = running;
      running -= e.monto;
      start = running;
    } else {
      // subtotal / resultado: barra total desde 0 hasta el acumulado actual.
      start = 0;
      end = running;
    }
    return { e, start, end, acumulado: running };
  });

  // Paso 2: escala al monto mayor de la trayectoria (normalmente los ingresos).
  const max = Math.max(1, ...raw.map((r) => Math.max(Math.abs(r.start), Math.abs(r.end))));

  return raw.map((r) => {
    let left: number;
    let width: number;
    if (r.e.tipo === "subtotal" || r.e.tipo === "resultado") {
      left = 0;
      width = clamp((Math.abs(r.end) / max) * 100, 0.8, 100);
    } else {
      const lo = Math.min(r.start, r.end);
      const hi = Math.max(r.start, r.end);
      left = clamp((Math.max(0, lo) / max) * 100, 0, 100);
      width = clamp(((hi - Math.max(0, lo)) / max) * 100, 0.8, 100);
    }
    const montoFirmado =
      r.e.tipo === "ingreso" ? r.e.monto : r.e.tipo === "resta" ? -Math.abs(r.e.monto) : r.acumulado;
    return {
      ...r.e,
      montoFirmado,
      acumulado: r.acumulado,
      left,
      width,
      negativo: (r.e.tipo === "subtotal" || r.e.tipo === "resultado") && r.acumulado < 0,
    };
  });
}
