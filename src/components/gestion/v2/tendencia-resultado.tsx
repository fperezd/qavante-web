import * as React from "react";
import { cn } from "@/lib/utils";
import { formatClp } from "@/lib/formatters/clp";

/* TendenciaResultado — el MARGEN operacional de los últimos meses en barras: contesta "¿estoy
   siendo más o menos rentable?" (independiente de si vendí más o menos — eso lo dice el $ del
   hero). Presentacional con barras CSS (no SVG, para que el texto no se deforme/agrande al ir a
   ancho completo): verdes si el margen es positivo, rojas si es negativo, con eje 0 cuando hay
   pérdidas; el mes en curso resaltado. El % por mes lo trae el breakdown (pct_by_month). */

export interface TendenciaPunto {
  /** Etiqueta corta del período (ej. "jul"). */
  periodo: string;
  /** Período completo "YYYY-MM" (para desambiguar el año cuando el rango cruza años). */
  periodoFull?: string;
  /** Margen operacional del mes (%, ej. 9.3). */
  margenPct: number;
  /** Resultado del mes en CLP (secundario, opcional; para el pie). */
  resultado?: number;
  /** Marca el mes en curso (parcial) → se resalta. */
  actual?: boolean;
}

/** Año de 2 dígitos de un período "YYYY-MM" ("2025-10" → "25"), o "" si no aplica. */
function anio2(periodoFull?: string): string {
  const m = periodoFull?.match(/^(\d{4})-/);
  return m ? m[1]!.slice(2) : "";
}

/** % compacto para el eje (entero, sin decimales) — evita que se pisen con muchas barras. */
function fmtPctCorto(v: number): string {
  return `${v < 0 ? "−" : ""}${Math.round(Math.abs(v))}%`;
}

export interface TendenciaResultadoProps {
  titulo?: string;
  puntos: TendenciaPunto[];
  className?: string;
}

function fmtPct(v: number): string {
  // Signo tipográfico (−) para negativos, consistente con formatClp (no el hyphen-minus de es-CL).
  const abs = Math.abs(v).toLocaleString("es-CL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${v < 0 ? "−" : ""}${abs}%`;
}

export function TendenciaResultado({
  titulo = "Margen operacional en el tiempo",
  puntos,
  className,
}: TendenciaResultadoProps) {
  const vacio = puntos.length === 0;
  const vals = puntos.map((p) => p.margenPct);
  const maxPos = Math.max(0, ...vals);
  const maxNeg = Math.max(0, ...vals.map((v) => -v));
  const hayNeg = maxNeg > 0;
  const total = maxPos + maxNeg || 1;
  // Proporción de alto para cada zona (positiva arriba / negativa abajo del eje 0).
  const posFlex = maxPos / total;
  const negFlex = maxNeg / total;
  const ultimo = puntos[puntos.length - 1];

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface shadow-sm",
        className,
      )}
      aria-label={titulo}
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-bold text-neutral-dark">{titulo}</h2>
      </div>
      {vacio ? (
        <p className="px-4 py-6 text-center text-xs text-neutral-mid">
          Sin histórico para mostrar la tendencia.
        </p>
      ) : (
        <div className="px-4 py-4">
          <div
            className="flex items-stretch gap-2 sm:gap-4"
            style={{ height: 168 }}
            aria-hidden="true"
          >
            {puntos.map((p, i) => {
              const neg = p.margenPct < 0;
              const posH = maxPos > 0 ? Math.max(3, (Math.max(0, p.margenPct) / maxPos) * 100) : 0;
              const negH = maxNeg > 0 ? Math.max(3, (Math.max(0, -p.margenPct) / maxNeg) * 100) : 0;
              const anio = anio2(p.periodoFull);
              const cambioAnio =
                anio !== "" && (i === 0 || anio2(puntos[i - 1]?.periodoFull) !== anio);
              return (
                <div
                  key={p.periodo + i}
                  className="flex min-w-0 flex-1 flex-col items-center"
                  title={`${p.periodo}${anio ? ` '${anio}` : ""}: ${fmtPct(p.margenPct)}`}
                >
                  {/* valor % arriba (compacto e entero → no se pisan con muchas barras) */}
                  <span
                    className={cn(
                      "mb-1 text-[10px] font-bold tabular-nums",
                      p.actual ? "text-neutral-dark" : "text-neutral-mid",
                    )}
                  >
                    {fmtPctCorto(p.margenPct)}
                  </span>
                  {/* zona positiva (barra crece hacia arriba desde el eje 0) */}
                  <div
                    className="flex w-full items-end justify-center"
                    style={{ flex: posFlex || 0.0001 }}
                  >
                    {!neg && (
                      <div
                        className={cn(
                          "animate-qv-grow-y w-full max-w-[64px] origin-bottom rounded-t-md",
                          p.actual
                            ? "bg-gradient-to-t from-success-700 to-success-500 shadow-sm"
                            : "bg-gradient-to-t from-success-600 to-success-500/45",
                        )}
                        style={{ height: `${posH}%` }}
                      />
                    )}
                  </div>
                  {/* eje 0 (solo si hay meses en pérdida) */}
                  {hayNeg && <div className="w-full border-t border-border-strong" />}
                  {/* zona negativa (barra crece hacia abajo desde el eje 0) */}
                  {hayNeg && (
                    <div
                      className="flex w-full items-start justify-center"
                      style={{ flex: negFlex || 0.0001 }}
                    >
                      {neg && (
                        <div
                          className="animate-qv-grow-y w-full max-w-[64px] origin-top rounded-b-md bg-gradient-to-b from-danger-500/75 to-danger-500/35"
                          style={{ height: `${negH}%` }}
                        />
                      )}
                    </div>
                  )}
                  {/* etiqueta del mes (+ año cuando cambia, para no confundir años) */}
                  <span className="mt-1.5 flex flex-col items-center leading-none">
                    <span
                      className={cn(
                        "text-[12px]",
                        p.actual ? "font-bold text-neutral-dark" : "text-neutral-mid",
                      )}
                    >
                      {p.periodo}
                    </span>
                    {cambioAnio && anio && (
                      <span className="mt-0.5 text-[9px] font-semibold text-neutral-light">
                        &apos;{anio}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          {ultimo && (
            <p className="mt-2 px-0.5 text-[11.5px] text-neutral-mid">
              Último mes <b className="text-neutral-dark">{fmtPct(ultimo.margenPct)}</b>
              {ultimo.resultado != null && <> · {formatClp(ultimo.resultado)}</>}
              {ultimo.actual && " · en curso"}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
