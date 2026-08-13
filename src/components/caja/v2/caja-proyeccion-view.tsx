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
  cobrosPorCobrar?: {
    glosa: string;
    monto: number;
    diasAtraso: number | null;
    folio?: string | null;
    /** Identidad del documento para conciliar de un clic (#851). Sin ella, la fila no lleva botón. */
    sourceExternalId?: string | null;
    side?: "receivable" | "payable";
    /** Ya conciliado en esta sesión (marcado "Ya lo cobré"): la fila muestra "Conciliado ✓" + "Deshacer"
     *  en vez de "Ya lo cobré", y persiste mientras estés en la pantalla (undo durable, no solo el toast). */
    conciliado?: boolean;
  }[];
  /** Conciliar FILA-POR-FILA (#851, flag `cajaMarkCollected`): si viene, cada fila con `sourceExternalId`
   *  suma un botón "Ya lo cobré" que concilia ese documento (mark-collected). Sin callback → la lista es
   *  solo de lectura (comportamiento actual). */
  onMarcarCobrado?: (item: { sourceExternalId: string; side: "receivable" | "payable" }) => void;
  /** Deshacer una conciliación (revert): la fila `conciliado` muestra "Deshacer" que devuelve el
   *  documento a por cobrar. Undo durable (no depende del toast). */
  onDeshacer?: (item: { sourceExternalId: string; side: "receivable" | "payable" }) => void;
  /** `sourceExternalId` de la fila con una acción en curso (conciliar o deshacer) → spinner + deshabilitar. */
  marcandoId?: string | null;
  /** Escenario "con recuperación del atraso" (ADR-0087): si viene, el caveat muestra cuánto MEJORA el
   *  piso SI cobras ese atraso — respuesta honesta al "sin recuperación" del core. */
  recuperacion?: { pisoRecup: number | null; totalRecuperado: number; ventanaDias: number } | null;
  /** Banda "con ingreso recurrente proyectado" (ADR-0089 B): mata el false-doom cuando la caja se ve en
   *  rojo pero entra ingreso recurrente. `null` → no hay ingreso proyectado, no se muestra. */
  ingresoProyectado?: {
    totalIngreso: number;
    nFlujos: number;
    pisoConIngresos: number | null;
    diasConIngresos: number | null;
  } | null;
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
  onMarcarCobrado,
  onDeshacer,
  marcandoId,
  recuperacion,
  ingresoProyectado,
  ocultarSaldoHoy,
  className,
}: CajaProyeccionViewProps) {
  const [verCobros, setVerCobros] = React.useState(false);
  // Estado honesto SOLO si el backend no tiene proyección. La cascada (movimientos) es un dato
  // SECUNDARIO derivado del maestro FE: si está vacía, NO ocultamos el medidor/caveat autoritativos
  // del backend (días de caja, piso, por-cobrar) — antes un OR lo tapaba todo por la cascada vacía.
  if (proyeccion == null) {
    return <CajaMedidorSinDato ultimaSync={ultimaSync} className={className} />;
  }

  // Solo explicamos "qué te hunde" cuando HAY un quiebre (la caja toca la mínima/cero); si está sana
  // no hay punto de quiebre que explicar (visión Parte 1: causas del quiebre, no de una caja holgada).
  const mostrarCausas = proyeccion.estado !== "sano" && (causas?.length ?? 0) > 0;
  // Caveat honesto: si la caja está en riesgo PERO hay plata por cobrar (vencida/sin fecha) que el
  // runway no cuenta, "sin recuperación" no es el veredicto final. No inventamos que se cobra —
  // decimos que existe y que no está en esta cifra.
  const mostrarPorCobrar = proyeccion.estado !== "sano" && (porCobrarVencido?.total ?? 0) > 0;
  // Banda de ingreso recurrente (ADR-0089 B): cuando la caja está en riesgo pero el negocio tiene
  // ingreso recurrente proyectado, lo decimos como CONTEXTO (mata el "te vas a fundir" falso).
  const mostrarIngresos =
    proyeccion.estado !== "sano" && (ingresoProyectado?.totalIngreso ?? 0) > 0;

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
                    {porCobrarVencido!.n}{" "}
                    {porCobrarVencido!.n === 1 ? "documento vencido" : "documentos vencidos"} o sin
                    fecha
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

              {recuperacion && (
                <p className="mt-1.5 border-t border-info-500/20 pt-1.5">
                  {recuperacion.pisoRecup != null ? (
                    <>
                      <b className="text-info-700">Con recuperación:</b> si cobras ese atraso
                      repartido en {recuperacion.ventanaDias} días, tu punto más bajo sería{" "}
                      <b className="text-neutral-dark tabular-nums">
                        {formatClp(recuperacion.pisoRecup)}
                      </b>
                      {/* "en vez de X" solo si la recuperación MEJORA el piso (pisoRecup > piso core).
                          Si no lo mejora (p.ej. el core no trae punto_quiebre y el piso cae al mínimo
                          de la serie, que puede ser mayor), la comparación se leería al revés. */}
                      {proyeccion.piso && recuperacion.pisoRecup > proyeccion.piso.saldo && (
                        <>
                          {" "}
                          en vez de{" "}
                          <span className="tabular-nums">{formatClp(proyeccion.piso.saldo)}</span>
                        </>
                      )}
                      .
                    </>
                  ) : (
                    <>
                      <b className="text-info-700">Con recuperación:</b> si cobras ese atraso
                      (repartido en {recuperacion.ventanaDias} días), tu caja no toca el punto de
                      quiebre: se sostiene.
                    </>
                  )}
                </p>
              )}

              {verCobros && cobrosPorCobrar && cobrosPorCobrar.length > 0 && (
                <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto border-t border-info-500/20 pt-2">
                  {cobrosPorCobrar.map((c, i) => {
                    const puedeConciliar = Boolean(onMarcarCobrado && c.sourceExternalId);
                    const enCurso = marcandoId != null && marcandoId === c.sourceExternalId;
                    const hayAccion = marcandoId != null;
                    return (
                      <li
                        key={`${c.glosa}-${i}`}
                        className="flex items-center justify-between gap-3 leading-tight"
                      >
                        <span className="min-w-0 truncate text-neutral-dark">
                          {c.conciliado && (
                            <span className="mr-1 font-semibold text-success-700">✓</span>
                          )}
                          <span
                            className={cn(
                              "truncate",
                              c.conciliado && "text-neutral-mid line-through",
                            )}
                          >
                            {c.glosa}
                          </span>
                          {c.folio && (
                            <span className="ml-1.5 text-[11px] font-normal text-neutral-mid">
                              · Folio {c.folio}
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-right">
                          <span
                            className={cn(
                              "font-semibold tabular-nums",
                              c.conciliado ? "text-neutral-mid line-through" : "text-neutral-dark",
                            )}
                          >
                            {formatClp(c.monto)}
                          </span>
                          {c.conciliado ? (
                            <>
                              <span className="text-[11px] font-medium text-success-700">
                                Conciliado
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  onDeshacer?.({
                                    sourceExternalId: c.sourceExternalId as string,
                                    side: c.side ?? "receivable",
                                  })
                                }
                                disabled={hayAccion}
                                className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-neutral-mid transition-colors hover:bg-neutral-light/40 hover:text-neutral-dark disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                              >
                                {enCurso ? "Deshaciendo…" : "Deshacer"}
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="text-[11px] text-neutral-mid">
                                {c.diasAtraso == null
                                  ? "sin fecha"
                                  : `${c.diasAtraso} días de atraso`}
                              </span>
                              {puedeConciliar && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onMarcarCobrado!({
                                      sourceExternalId: c.sourceExternalId as string,
                                      side: c.side ?? "receivable",
                                    })
                                  }
                                  disabled={hayAccion}
                                  className="rounded-md border border-info-500/40 px-2 py-0.5 text-[11px] font-semibold text-info-700 transition-colors hover:bg-info-500/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info-500"
                                >
                                  {enCurso ? "Conciliando…" : "Ya lo cobré"}
                                </button>
                              )}
                            </>
                          )}
                        </span>
                      </li>
                    );
                  })}
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
          {mostrarIngresos && (
            <div className="mt-3 rounded-lg border border-success-500/30 bg-success-500/[.06] px-3 py-2 text-xs text-neutral-dark">
              <p>
                <b className="text-success-700">Tienes ingreso recurrente en camino:</b> proyectamos{" "}
                <b className="tabular-nums">{formatClp(ingresoProyectado!.totalIngreso)}</b> en{" "}
                {ingresoProyectado!.nFlujos} {ingresoProyectado!.nFlujos === 1 ? "cobro" : "cobros"}
                , estimado por tu historial de abonos.
                {ingresoProyectado!.pisoConIngresos == null &&
                  " Contándolo, tu caja no toca el punto de quiebre."}
              </p>
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
          {movimientos.length > 0 ? (
            <CajaCascada saldoHoy={proyeccion.saldoHoy} movimientos={movimientos} />
          ) : (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-neutral-mid">
              Todavía no hay detalle de próximos movimientos para mostrar. El medidor de la
              izquierda ya sale del banco.
            </p>
          )}
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
