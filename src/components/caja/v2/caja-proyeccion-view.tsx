import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClp } from "@/lib/formatters/clp";
import { CajaMedidor, CajaMedidorSinDato } from "./caja-medidor";
import { CajaCascada } from "./caja-cascada";
import type { DiasCaja } from "./caja-dias-model";
import type { MovimientoCaja } from "./caja-cascada-model";
import type { CausaQuiebre } from "./caja-proyeccion-model";

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
  /** Top causas (mayores egresos) que llevan la caja al punto más bajo. */
  causas?: CausaQuiebre[];
  /** Fecha legible de la última sync del banco (para el estado honesto / la nota de saldo viejo). */
  ultimaSync?: string | null;
  /** El `cash_today` viene stale (banco sin sincronizar reciente) → avisamos honesto. */
  saldoStale?: boolean;
  /** Por cobrar VENCIDO/sin-fecha (del backend, `por_cobrar_vencido`): NO entra al runway (su cobro
   *  no es cierto). Se muestra como caveat honesto para que "sin recuperación" no se lea como veredicto
   *  final cuando hay plata por cobrar. `null`/total 0 → no se muestra. */
  porCobrarVencido?: { total: number; n: number } | null;
  /** Ruta a la conciliación: si viene, el caveat del por-cobrar suma un CTA "Conciliar cobros →" para
   *  que el dueño resuelva esos documentos de un clic (pedido de Fernando: no dejarlo en callejón). */
  conciliarHref?: string;
  /** Detalle de los cobros vencidos/sin-fecha (glosa/monto/días): el dueño puede desplegar la lista y
   *  verlos uno por uno desde el caveat (pedido de Fernando). Vacío → no hay lista para desplegar. */
  cobrosPorCobrar?: { glosa: string; monto: number; diasAtraso: number | null }[];
  /** Oculta el "Saldo hoy" del medidor (el hero de la pantalla ya lo muestra → no repetir). */
  ocultarSaldoHoy?: boolean;
  className?: string;
}

export function CajaProyeccionView({
  proyeccion,
  minimo,
  movimientos,
  causas,
  ultimaSync,
  saldoStale,
  porCobrarVencido,
  conciliarHref,
  cobrosPorCobrar,
  ocultarSaldoHoy,
  className,
}: CajaProyeccionViewProps) {
  const [verCobros, setVerCobros] = React.useState(false);
  // Sin proyección forward (ni movimientos ni días) → estado honesto, no una curva inventada.
  if (proyeccion == null || movimientos.length === 0) {
    return <CajaMedidorSinDato ultimaSync={ultimaSync} className={className} />;
  }

  // Solo explicamos "qué te hunde" cuando HAY un quiebre (la caja toca la mínima/cero); si está sana
  // no hay punto de quiebre que explicar (visión Parte 1: causas del quiebre, no de una caja holgada).
  const mostrarCausas = proyeccion.estado !== "sano" && (causas?.length ?? 0) > 0;
  // Caveat honesto: si la caja está en riesgo PERO hay plata por cobrar (vencida/sin fecha) que el
  // runway no cuenta, "sin recuperación" no es el veredicto final. No inventamos que se cobra —
  // decimos que existe y que no está en esta cifra.
  const mostrarPorCobrar = proyeccion.estado !== "sano" && (porCobrarVencido?.total ?? 0) > 0;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Medidor a la IZQUIERDA, cascada a la DERECHA, en la misma línea (en xl+); apilados en
          pantallas más chicas para no apretar el medidor. */}
      <div className="grid gap-6 xl:grid-cols-2 xl:items-center">
        <div>
          <CajaMedidor model={proyeccion} minimo={minimo} ocultarSaldoHoy={ocultarSaldoHoy} />
          {mostrarPorCobrar && (
            <div className="mt-3 rounded-lg border border-info-500/30 bg-info-500/[.06] px-3 py-2 text-xs text-neutral-dark">
              <p>
                Esta proyección <b>no cuenta</b> los {formatClp(porCobrarVencido!.total)} que tienes
                por cobrar (
                {(cobrosPorCobrar?.length ?? 0) > 0 ? (
                  <button
                    type="button"
                    onClick={() => setVerCobros((v) => !v)}
                    className="font-semibold text-info-700 underline underline-offset-2"
                    aria-expanded={verCobros}
                  >
                    {porCobrarVencido!.n} {porCobrarVencido!.n === 1 ? "documento" : "documentos"}{" "}
                    vencidos o sin fecha
                  </button>
                ) : (
                  <>
                    {porCobrarVencido!.n}{" "}
                    {porCobrarVencido!.n === 1 ? "documento vencido" : "documentos vencidos"} o sin
                    fecha de pago
                  </>
                )}
                ). Si ya cobraste alguno, <b>concílialo</b> para que salga de acá; su cobro no es
                seguro, por eso no entra en esta cifra.
              </p>

              {verCobros && cobrosPorCobrar && cobrosPorCobrar.length > 0 && (
                <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto border-t border-info-500/20 pt-2">
                  {cobrosPorCobrar.map((c, i) => (
                    <li
                      key={`${c.glosa}-${i}`}
                      className="flex items-center justify-between gap-3 leading-tight"
                    >
                      <span className="min-w-0 truncate text-neutral-dark">{c.glosa}</span>
                      <span className="shrink-0 whitespace-nowrap text-right">
                        <span className="font-semibold tabular-nums text-neutral-dark">
                          {formatClp(c.monto)}
                        </span>
                        <span className="ml-2 text-[11px] text-neutral-mid">
                          {c.diasAtraso == null ? "sin fecha" : `${c.diasAtraso} días de atraso`}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {conciliarHref && (
                <Link
                  href={conciliarHref}
                  className="mt-1.5 inline-flex items-center gap-1 font-semibold text-info-700 hover:underline"
                >
                  Conciliar cobros
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
            </div>
          )}
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

      {mostrarCausas && <CausasQuiebre causas={causas!} />}
    </div>
  );
}

const TIPO_LABEL: Record<string, string> = {
  impuesto: "Impuesto",
  sueldos: "Sueldos",
  proveedor: "Proveedor",
  otro: "Pago",
};

/** "Qué te lleva al punto más bajo": los mayores egresos que hunden la caja hasta el piso. */
function CausasQuiebre({ causas }: { causas: CausaQuiebre[] }) {
  return (
    <section
      aria-label="Qué te lleva al punto más bajo"
      className="rounded-xl border border-warning-500/40 bg-warning-500/[.06] p-5"
    >
      <div className="flex items-center gap-2 text-sm font-bold text-neutral-dark">
        <AlertTriangle className="h-4 w-4 text-warning-700" aria-hidden="true" />
        Qué te lleva al punto más bajo
      </div>
      <ul className="mt-3 space-y-1.5">
        {causas.map((c, i) => (
          <li
            key={`${c.label}-${i}`}
            className="flex items-center justify-between gap-3 border-t border-dashed border-border pt-1.5 text-sm first:border-t-0 first:pt-0"
          >
            <span className="min-w-0 truncate text-neutral-dark">
              {c.label}
              {c.tipo && (
                <span className="ml-2 rounded bg-neutral-light/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-mid">
                  {TIPO_LABEL[c.tipo] ?? c.tipo}
                </span>
              )}
            </span>
            <span className="shrink-0 whitespace-nowrap text-right">
              <span className="font-semibold tabular-nums text-danger-500">
                −{formatClp(Math.abs(c.monto))}
              </span>
              <span className="ml-2 text-xs text-neutral-mid">{c.fechaLabel}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
