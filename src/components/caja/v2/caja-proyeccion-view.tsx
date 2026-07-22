import * as React from "react";
import { cn } from "@/lib/utils";
import { CajaMedidor, CajaMedidorSinDato } from "./caja-medidor";
import { CajaCascada } from "./caja-cascada";
import type { DiasCaja } from "./caja-dias-model";
import type { MovimientoCaja } from "./caja-cascada-model";

/* CajaProyeccionView — ensambla el rediseño del "Saldo proyectado" del Caja v3: el MEDIDOR de días
   de caja (respuesta "¿me alcanza?") + la CASCADA de próximos movimientos (de dónde salen los días).
   Ambos derivan de los vencimientos (cobranzas + obligaciones), no del cash-flow histórico. Si no
   hay proyección forward (sin vencimientos futuros), muestra el estado honesto — nunca una recta
   sobre nada. Presentacional PURO: recibe la proyección ya calculada + los movimientos. */

export interface CajaProyeccionViewProps {
  /** Proyección date-aware (de `proyeccionDeMovimientos`). `null` → estado honesto. */
  proyeccion: DiasCaja | null;
  /** Caja mínima (CLP) o `null`. */
  minimo: number | null;
  /** Movimientos futuros derivados (para la cascada). */
  movimientos: MovimientoCaja[];
  /** Fecha legible de la última sync del banco (para el estado honesto / la nota de saldo viejo). */
  ultimaSync?: string | null;
  /** El `cash_today` viene stale (banco sin sincronizar reciente) → avisamos honesto. */
  saldoStale?: boolean;
  /** Oculta el "Saldo hoy" del medidor (el hero de la pantalla ya lo muestra → no repetir). */
  ocultarSaldoHoy?: boolean;
  className?: string;
}

export function CajaProyeccionView({
  proyeccion,
  minimo,
  movimientos,
  ultimaSync,
  saldoStale,
  ocultarSaldoHoy,
  className,
}: CajaProyeccionViewProps) {
  // Sin proyección forward (ni movimientos ni días) → estado honesto, no una curva inventada.
  if (proyeccion == null || movimientos.length === 0) {
    return <CajaMedidorSinDato ultimaSync={ultimaSync} className={className} />;
  }

  return (
    // Medidor a la IZQUIERDA, cascada a la DERECHA, en la misma línea (en xl+); apilados en pantallas
    // más chicas para no apretar el medidor. Antes iban uno arriba del otro.
    <div className={cn("grid gap-6 xl:grid-cols-2 xl:items-center", className)}>
      <div>
        <CajaMedidor model={proyeccion} minimo={minimo} ocultarSaldoHoy={ocultarSaldoHoy} />
        {saldoStale && ultimaSync && (
          <p className="mt-3 text-xs text-neutral-mid">
            Proyección sobre el saldo del banco al {ultimaSync} (última sincronización). Actualiza
            el banco para el saldo de hoy.
          </p>
        )}
      </div>

      <section aria-label="Próximos movimientos">
        <h3 className="mb-2 text-sm font-semibold text-neutral-dark">
          Próximos movimientos · de dónde salen los días
        </h3>
        <CajaCascada saldoHoy={proyeccion.saldoHoy} movimientos={movimientos} />
      </section>
    </div>
  );
}
