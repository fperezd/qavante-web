import * as React from "react";
import { cn } from "@/lib/utils";
import { indiceMasBajo, type SaldoPunto } from "./caja-curva-model";

/* CajaCurva — la curva de saldo proyectado del Caja v2: baja en el tiempo hacia la
   línea de caja mínima y marca el punto más bajo (cuándo la caja "toca el piso").
   Presentacional puro (SVG sin libs). Grid vertical (una línea por período, ordena),
   línea de caja mínima + zona bajo el mínimo, y eventos como guías verticales con su
   etiqueta alineada arriba. El saldo acumulado se deriva en `caja-curva-model`. */

export interface CajaCurvaEvento {
  /** Índice del punto (0-based) donde ocurre el evento. */
  indice: number;
  label: string;
  /** "crit" (el cruce / punto bajo) se dibuja en rojo; "info" en gris. */
  tono?: "info" | "crit";
}

export interface CajaCurvaProps {
  /** Serie de saldo por período, más antiguo primero (el primero suele ser "hoy"). */
  serie: SaldoPunto[];
  /** Línea de caja mínima (el piso). `null`/omitida → no hay mínimo configurado: se dibuja
   *  una referencia neutra de $0 en su lugar (sin la zona roja "bajo el mínimo"). */
  minimo?: number | null;
  /** Eventos a marcar (línea vertical + etiqueta). */
  eventos?: CajaCurvaEvento[];
  /** Alto del gráfico en px (default 250). */
  height?: number;
  className?: string;
}

const W = 820;
const PADX = 12;

export function CajaCurva({ serie, minimo, eventos = [], height = 250, className }: CajaCurvaProps) {
  const id = React.useId();
  if (serie.length < 2) return null; // sin ≥2 puntos no hay curva

  const hayMinimo = minimo != null;
  // Referencia horizontal: la caja mínima si está configurada, si no el $0 (neutro).
  const ref = hayMinimo ? minimo : 0;

  const H = height;
  // El tope reserva espacio para las etiquetas de eventos (que se dibujan arriba de la curva).
  // Sin eventos no hay nada que reservar → tope chico, así la curva no queda con un vacío arriba.
  const plotTop = eventos.length > 0 ? 46 : 18;
  const plotBottom = H - 36;
  const saldos = serie.map((p) => p.saldo);
  // Encuadre SOBRE LOS DATOS (+ el mínimo si existe, que es el piso y hay que verlo). El $0
  // de contexto NO se fuerza al dominio: si queda muy por encima de una caja profundamente
  // negativa y plana, aplastaría la curva contra el piso y dejaría el gráfico casi vacío. En
  // ese caso encuadramos la tendencia — el hero ya comunica el negativo en rojo.
  const domain = hayMinimo ? [...saldos, ref] : [...saldos];
  let top = Math.max(...domain);
  let bot = Math.min(...domain);
  const span = top - bot || Math.abs(top) || 1;
  top += span * 0.15;
  bot -= span * 0.15;
  // La referencia ($0 o mínimo) se dibuja solo si cae dentro del encuadre.
  const refDentro = ref <= top && ref >= bot;

  const xOf = (i: number) => PADX + (i * (W - PADX * 2)) / (serie.length - 1);
  const yOf = (v: number) => plotTop + ((top - v) / (top - bot)) * (plotBottom - plotTop);

  const line = serie
    .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(p.saldo).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${xOf(serie.length - 1).toFixed(1)},${plotBottom} L${PADX},${plotBottom} Z`;
  const refY = yOf(ref);
  const bajoIdx = indiceMasBajo(saldos);
  // El punto más bajo se marca en ROJO solo si realmente cae bajo la caja mínima; si no hay
  // mínimo configurado (o el piso nunca se cruza) es un mínimo sano → color neutro, no alarma.
  const bajoCrit = hayMinimo && bajoIdx != null && (saldos[bajoIdx] as number) < ref;

  return (
    // Escala UNIFORME (sin preserveAspectRatio="none"): antes el "none" estiraba el eje X y
    // distorsionaba los <text> (Caja mínima / $0 / etiquetas). Ahora el SVG escala a lo ancho
    // manteniendo proporción (alto auto desde el viewBox), así el texto no se deforma.
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      className={cn("block h-auto w-full", className)}
      role="img"
      aria-label="Curva de saldo proyectado"
    >
      <defs>
        <linearGradient id={`cf-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brand-primary)" stopOpacity="0.26" />
          <stop offset="100%" stopColor="var(--color-brand-primary)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* grid vertical: una línea por período */}
      <g stroke="var(--color-border)" strokeWidth="1">
        {serie.map((_, i) => (
          <line key={i} x1={xOf(i)} y1={plotTop} x2={xOf(i)} y2={plotBottom} />
        ))}
      </g>

      {hayMinimo ? (
        <>
          {/* zona bajo el mínimo (solo cuando hay mínimo real configurado) + su línea */}
          <rect
            x={PADX}
            y={refY}
            width={W - PADX * 2}
            height={Math.max(0, plotBottom - refY)}
            fill="var(--color-danger-500)"
            opacity="0.06"
          />
          <line
            x1={PADX}
            y1={refY}
            x2={W - PADX}
            y2={refY}
            stroke="var(--color-danger-500)"
            strokeWidth="1.5"
            strokeDasharray="5 4"
            opacity="0.7"
          />
          <text x={W - PADX} y={refY - 5} textAnchor="end" fontSize="10" fontWeight="700" fill="var(--color-danger-500)">
            Caja mínima
          </text>
        </>
      ) : refDentro ? (
        <>
          {/* sin mínimo configurado: referencia neutra de $0 (no roja, no zona) */}
          <line
            x1={PADX}
            y1={refY}
            x2={W - PADX}
            y2={refY}
            stroke="var(--color-neutral-light)"
            strokeWidth="1"
            strokeDasharray="2 3"
            opacity="0.8"
          />
          <text x={PADX + 2} y={refY - 5} fontSize="10" fontWeight="600" fill="var(--color-neutral-mid)">
            $0
          </text>
        </>
      ) : null}

      {/* área + curva del saldo */}
      <path d={area} fill={`url(#cf-${id})`} />
      <path
        d={line}
        fill="none"
        stroke="var(--color-brand-primary)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* eventos: guía vertical + etiqueta alineada arriba */}
      {eventos.map((e, k) => {
        const crit = e.tono === "crit";
        const color = crit ? "var(--color-danger-500)" : "var(--color-neutral-mid)";
        return (
          <g key={k}>
            <line
              x1={xOf(e.indice)}
              y1={30}
              x2={xOf(e.indice)}
              y2={yOf(saldos[e.indice] as number)}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity={crit ? 0.75 : 0.5}
            />
            <text x={xOf(e.indice)} y={22} textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>
              {e.label}
            </text>
          </g>
        );
      })}

      {/* punto inicial + punto más bajo */}
      <circle
        cx={xOf(0)}
        cy={yOf(saldos[0] as number)}
        r="3.6"
        fill="var(--color-brand-primary)"
        stroke="var(--color-surface)"
        strokeWidth="1.5"
      />
      {bajoIdx != null && (
        <>
          {bajoCrit && (
            <circle cx={xOf(bajoIdx)} cy={yOf(saldos[bajoIdx] as number)} r="6.5" fill="var(--color-danger-500)" fillOpacity="0.18" />
          )}
          <circle
            cx={xOf(bajoIdx)}
            cy={yOf(saldos[bajoIdx] as number)}
            r="3.6"
            fill={bajoCrit ? "var(--color-danger-500)" : "var(--color-brand-primary)"}
            stroke="var(--color-surface)"
            strokeWidth="1.5"
          />
        </>
      )}

      {/* eje x: una etiqueta por período */}
      {serie.map((p, i) => (
        <text
          key={i}
          x={xOf(i)}
          y={H - 12}
          textAnchor={i === 0 ? "start" : i === serie.length - 1 ? "end" : "middle"}
          fontSize="9.5"
          fill="var(--color-neutral-mid)"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}
