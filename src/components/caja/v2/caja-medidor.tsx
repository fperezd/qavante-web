import * as React from "react";
import { cn } from "@/lib/utils";
import { formatClp } from "@/lib/formatters/clp";
import { diasParaAguja, type DiasCaja, type EstadoCaja } from "./caja-dias-model";

/* CajaMedidor — el "medidor de días de caja" del Caja v3: responde "¿me alcanza?" en DÍAS, no en
   pesos sobre un eje. Un gauge tipo velocímetro (zonas rojo/ámbar/verde + aguja) con el número al
   centro, más un readout con el titular, el detalle (piso + recuperación) y las cifras clave.
   Presentacional PURO (SVG sin libs): la derivación vive en `caja-dias-model`. Si no hay dato
   suficiente, el caller usa <CajaMedidorSinDato/> (nunca una curva de confianza sobre 2 puntos). */

const TONE: Record<EstadoCaja, { color: string; soft: string; label: string }> = {
  sano: {
    color: "var(--color-success-500)",
    soft: "var(--color-success-50)",
    label: "Caja holgada",
  },
  ajustado: {
    color: "var(--color-warning-500)",
    soft: "var(--color-warning-50)",
    label: "Caja ajustada",
  },
  critico: {
    color: "var(--color-danger-500)",
    soft: "var(--color-danger-50)",
    label: "Caja en riesgo",
  },
};

const A0 = -125;
const A1 = 125;

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function arcPath(cx: number, cy: number, r: number, s: number, e: number): string {
  const [ax, ay] = polar(cx, cy, r, s);
  const [bx, by] = polar(cx, cy, r, e);
  const large = e - s > 180 ? 1 : 0;
  return `M${ax.toFixed(1)},${ay.toFixed(1)} A${r},${r} 0 ${large} 1 ${bx.toFixed(1)},${by.toFixed(1)}`;
}

export interface CajaMedidorGaugeProps {
  /** Días que "te alcanza" (aguja). */
  dias: number;
  /** Tope del medidor en días (default 60 ≈ 2 meses). */
  max?: number;
  tono: EstadoCaja;
  /** Texto grande del centro (ej. "14" o "60+"). */
  centro: string;
  className?: string;
}

/** Gauge tipo velocímetro: track + zonas (rojo bajo, ámbar medio, verde alto) + aguja + número. */
export function CajaMedidorGauge({
  dias,
  max = 60,
  tono,
  centro,
  className,
}: CajaMedidorGaugeProps) {
  const cx = 130;
  const cy = 120;
  const r = 88;
  const sp = A1 - A0;
  const ang = (v: number) => A0 + Math.max(0, Math.min(1, v / max)) * sp;
  const z1 = max * 0.2; // fin de la zona roja
  const z2 = max * 0.4; // fin de la zona ámbar
  const tip = polar(cx, cy, r, ang(dias));
  const base1 = polar(cx, cy, 11, ang(dias) + 90);
  const base2 = polar(cx, cy, 11, ang(dias) - 90);
  const col = TONE[tono].color;

  return (
    <svg
      viewBox="0 0 260 200"
      className={cn("block h-auto w-full", className)}
      role="img"
      aria-label={`Medidor: ${centro} días de caja`}
    >
      <path
        d={arcPath(cx, cy, r, A0, A1)}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth="16"
        strokeLinecap="round"
      />
      <path
        d={arcPath(cx, cy, r, ang(0), ang(z1))}
        fill="none"
        stroke="var(--color-danger-500)"
        strokeWidth="16"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d={arcPath(cx, cy, r, ang(z1), ang(z2))}
        fill="none"
        stroke="var(--color-warning-500)"
        strokeWidth="16"
        opacity="0.85"
      />
      <path
        d={arcPath(cx, cy, r, ang(z2), ang(max))}
        fill="none"
        stroke="var(--color-success-500)"
        strokeWidth="16"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d={`M${base1[0]},${base1[1]} L${tip[0]},${tip[1]} L${base2[0]},${base2[1]} Z`}
        fill={col}
      />
      <circle cx={cx} cy={cy} r="7" fill={col} stroke="var(--color-surface)" strokeWidth="2" />
      <text
        x={cx}
        y={cy + 44}
        textAnchor="middle"
        fontSize="42"
        fontWeight="800"
        fill="currentColor"
      >
        {centro}
      </text>
      <text
        x={cx}
        y={cy + 62}
        textAnchor="middle"
        fontSize="12"
        fill="var(--color-neutral-mid)"
        letterSpacing="0.04em"
      >
        días de caja
      </text>
    </svg>
  );
}

/** Redondeo "humano" de días: mantiene enteros chicos, no inventa precisión falsa. */
function dLabel(d: number): string {
  return `~${Math.max(0, Math.round(d))} días`;
}

function titular(m: DiasCaja, ref: number): { headline: string; detalle: string } {
  const recup =
    m.diasRecuperacion != null
      ? `, te recuperás en ${dLabel(m.diasRecuperacion)}`
      : ", sin recuperación en el horizonte";
  const pisoBajo = m.piso != null && m.piso.saldo < ref;
  const detalle = pisoBajo
    ? `Piso ${formatClp(m.piso!.saldo)} en ${dLabel(m.piso!.dia)}${recup}.`
    : `No bajás de tu caja mínima en los próximos ${Math.round(m.horizonteDias)} días.`;

  if (m.estado === "critico") {
    if (m.saldoHoy < 0) return { headline: "Tu caja está en rojo hoy", detalle };
    return { headline: `Entrás en rojo en ${dLabel(m.diasHastaCero ?? 0)}`, detalle };
  }
  if (m.estado === "ajustado")
    return { headline: `Te alcanza ${dLabel(m.diasHastaMinimo ?? 0)}`, detalle };
  return { headline: "Caja holgada", detalle };
}

export interface CajaMedidorProps {
  model: DiasCaja;
  /** Caja mínima configurada (CLP) o `null`. Solo para las cifras del readout. */
  minimo: number | null;
  /** Tope del medidor en días. */
  max?: number;
  className?: string;
}

/** Tarjeta completa: gauge + titular + detalle + cifras clave (piso / mínima / saldo hoy). */
export function CajaMedidor({ model, minimo, max = 60, className }: CajaMedidorProps) {
  const ref = minimo ?? 0;
  const aguja = diasParaAguja(model, max);
  const centro =
    model.saldoHoy < 0
      ? "0"
      : model.diasHastaMinimo == null
        ? `${Math.round(model.horizonteDias)}+`
        : String(Math.round(model.diasHastaMinimo));
  const { headline, detalle } = titular(model, ref);
  const tone = TONE[model.estado];

  return (
    <section
      className={cn("grid items-center gap-5 sm:grid-cols-[220px_1fr]", className)}
      aria-label="Medidor de días de caja"
    >
      <CajaMedidorGauge dias={aguja} max={max} tono={model.estado} centro={centro} />
      <div className="min-w-0">
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold"
          style={{ background: tone.soft, color: tone.color }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "currentColor" }}
            aria-hidden="true"
          />
          {tone.label}
        </span>
        <h3
          className="mt-2 text-2xl font-extrabold tracking-tight"
          style={{ color: model.estado === "critico" ? tone.color : undefined }}
        >
          {headline}
        </h3>
        <p className="mt-1 text-sm text-neutral-mid">{detalle}</p>
        <dl className="mt-4 flex flex-wrap gap-x-7 gap-y-2">
          {model.piso && (
            <div>
              <dt className="text-xs text-neutral-mid">Piso proyectado</dt>
              <dd
                className="text-lg font-bold"
                style={{ color: model.piso.saldo < 0 ? "var(--color-danger-500)" : undefined }}
              >
                {formatClp(model.piso.saldo)}
              </dd>
            </div>
          )}
          {minimo != null && (
            <div>
              <dt className="text-xs text-neutral-mid">Caja mínima</dt>
              <dd className="text-lg font-bold">{formatClp(minimo)}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-neutral-mid">Saldo hoy</dt>
            <dd
              className="text-lg font-bold"
              style={{ color: model.saldoHoy < 0 ? "var(--color-danger-500)" : undefined }}
            >
              {formatClp(model.saldoHoy)}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export interface CajaMedidorSinDatoProps {
  /** Fecha legible de la última sincronización del banco (ej. "18-jul"), o `null`. */
  ultimaSync?: string | null;
  className?: string;
}

/** Estado honesto: sin dato suficiente NO proyectamos. En vez de una recta que miente, explicamos
 *  por qué y ofrecemos actualizar el banco. */
export function CajaMedidorSinDato({ ultimaSync, className }: CajaMedidorSinDatoProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center",
        className,
      )}
    >
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="var(--color-neutral-mid)" strokeWidth="1.5" />
        <path
          d="M12 7v6M12 16.5v.01"
          stroke="var(--color-neutral-mid)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      <p className="text-base font-semibold">Todavía no hay suficiente movimiento para proyectar</p>
      <p className="max-w-sm text-sm text-neutral-mid">
        {ultimaSync ? `Banco sincronizado por última vez el ${ultimaSync}. ` : ""}
        Actualizá el banco para ver cuántos días te alcanza la caja.
      </p>
    </div>
  );
}
