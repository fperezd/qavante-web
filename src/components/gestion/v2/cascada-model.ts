/* Modelo PURO de la cascada del resultado (waterfall) de Gestión v2 (sin React → testeable).
   Convierte la secuencia del P&L (Ingresos → −Costos → Margen bruto → −Gastos → Resultado)
   en barras flotantes: cada resta arranca donde termina el acumulado anterior. Deriva la
   posición (left) y el largo (width) de cada barra como % del monto mayor (los ingresos).

   Todo se calcula desde el contrato `OperationalResultResponse` que ya existe (revenue,
   direct_cost, gross_margin, labor_cost, professional_fees, recurring_expenses, result);
   no inventa datos. Montos en CLP (números; el string-decimal se parsea antes). */

export type CascadaTipo = "ingreso" | "resta" | "ajuste" | "subtotal" | "resultado";

export interface CascadaEntrada {
  id: string;
  label: string;
  tipo: CascadaTipo;
  /** Monto en CLP. Para `resta` es la magnitud (positiva) que se descuenta; para `ajuste` es
   *  FIRMADO (+ suma, − resta), p.ej. la conciliación "Otros" para que la cascada foote al
   *  resultado del backend; para `subtotal`/`resultado` se ignora (se deriva del acumulado). */
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
    } else if (e.tipo === "ajuste") {
      // Ajuste firmado: + suma, − resta. Barra flotante entre el acumulado previo y el nuevo.
      start = running;
      running += e.monto;
      end = running;
    } else {
      // subtotal / resultado: barra total desde 0 hasta el acumulado actual.
      start = 0;
      end = running;
    }
    return { e, start, end, acumulado: running };
  });

  // Paso 2: escala al DOMINIO completo [min, max] de la trayectoria — incluye el 0 y los tramos
  // NEGATIVOS (meses de pérdida). `pos(v)` mapea un valor crudo a % del eje. Con solo positivos
  // min=0 → `pos(v)=v/max` → idéntico a escalar por el máximo (el caso común no cambia). El bug
  // anterior recortaba lo que caía bajo cero (`Math.max(0, lo)`) → barras de pérdida encogidas.
  const vals = raw.flatMap((r) => [r.start, r.end]);
  const domMin = Math.min(0, ...vals);
  const domMax = Math.max(0, ...vals);
  const span = Math.max(1, domMax - domMin);
  const pos = (v: number) => clamp(((v - domMin) / span) * 100, 0, 100);

  return raw.map((r) => {
    let left: number;
    let width: number;
    if (r.e.tipo === "subtotal" || r.e.tipo === "resultado") {
      // Barra total: del 0 al acumulado (a la izquierda del 0 si es pérdida).
      left = pos(Math.min(0, r.end));
      width = clamp(pos(Math.max(0, r.end)) - pos(Math.min(0, r.end)), 0.8, 100);
    } else {
      const lo = Math.min(r.start, r.end);
      const hi = Math.max(r.start, r.end);
      left = pos(lo);
      width = clamp(pos(hi) - pos(lo), 0.8, 100);
    }
    const montoFirmado =
      r.e.tipo === "ingreso"
        ? r.e.monto
        : r.e.tipo === "resta"
          ? -Math.abs(r.e.monto)
          : r.e.tipo === "ajuste"
            ? r.e.monto // ya viene firmado
            : r.acumulado;
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
