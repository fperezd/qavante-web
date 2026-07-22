import * as React from "react";
import { cn } from "@/lib/utils";
import {
  construirCascada,
  rangoCascada,
  type MovimientoCaja,
  type PasoCascada,
} from "./caja-cascada-model";

/* CajaCascada — la cascada de caja del Caja v3: de "saldo hoy" a "proyectado", con cada movimiento
   en su FECHA moviendo el saldo corriente. Cobranzas suman (verde), sueldos/proveedores/impuestos
   restan (rojo); los anclas (hoy/proyectado) en color de marca. Barras flotantes con conectores al
   saldo corriente, línea de $0, y el piso marcado. Presentacional PURO (SVG sin libs) — la
   derivación vive en `caja-cascada-model`. */

const W = 640;
const PADL = 46;
const PADR = 14;

/** Compacto para caber en las barras: `$6,2M` / `$540k` / `−$1,8M`. */
function compacto(v: number): string {
  const s = v < 0 ? "−" : "";
  const a = Math.abs(v);
  if (a >= 1_000_000)
    return `${s}$${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1).replace(".", ",")}M`;
  if (a >= 1_000) return `${s}$${Math.round(a / 1_000)}k`;
  return `${s}$${Math.round(a)}`;
}

function colorDe(kind: PasoCascada["kind"]): string {
  if (kind === "in") return "var(--color-success-500)";
  if (kind === "out") return "var(--color-danger-500)";
  return "var(--color-brand-primary)";
}

export interface CajaCascadaProps {
  saldoHoy: number;
  movimientos: MovimientoCaja[];
  /** Etiqueta del ancla final. */
  labelProyectado?: string;
  height?: number;
  className?: string;
}

export function CajaCascada({
  saldoHoy,
  movimientos,
  labelProyectado = "Proyectado",
  height = 250,
  className,
}: CajaCascadaProps) {
  const pasos = construirCascada(saldoHoy, movimientos, labelProyectado);
  if (pasos.length < 2) return null;

  const H = height;
  const plotTop = 20;
  const plotBottom = H - 50; // espacio para etiqueta (nombre) + fecha
  const { min, max } = rangoCascada(pasos);
  const span = max - min || Math.abs(max) || 1;
  const top = max + span * 0.14;
  const bot = min - span * 0.14;

  const n = pasos.length;
  const slot = (W - PADL - PADR) / n;
  const bw = Math.min(56, slot * 0.58);
  const cxOf = (i: number) => PADL + (i + 0.5) * slot;
  const yOf = (v: number) => plotTop + ((top - v) / (top - bot)) * (plotBottom - plotTop);

  const y0 = yOf(0);

  // Ticks "lindos" del eje Y (5 líneas incl. el $0).
  const ticks: number[] = [];
  for (let k = 0; k <= 4; k++) ticks.push(bot + ((top - bot) * k) / 4);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      className={cn("mx-auto block h-auto w-full max-w-[640px]", className)}
      role="img"
      aria-label="Cascada de caja: de saldo hoy a proyectado por fecha"
    >
      {/* grid + eje Y */}
      {ticks.map((v, i) => (
        <g key={i}>
          <line
            x1={PADL}
            y1={yOf(v)}
            x2={W - PADR}
            y2={yOf(v)}
            stroke="var(--color-border)"
            strokeWidth="1"
            opacity={Math.abs(v) < 1 ? 0.9 : 0.4}
          />
          <text
            x={PADL - 6}
            y={yOf(v) + 3}
            textAnchor="end"
            fontSize="10"
            fill="var(--color-neutral-mid)"
          >
            {compacto(v)}
          </text>
        </g>
      ))}
      {/* línea de $0 marcada */}
      <line
        x1={PADL}
        y1={y0}
        x2={W - PADR}
        y2={y0}
        stroke="var(--color-neutral-mid)"
        strokeWidth="1.25"
        opacity="0.7"
      />

      {pasos.map((p, i) => {
        const cx = cxOf(i);
        const col = colorDe(p.kind);
        // geometría de la barra flotante
        let barTopVal: number;
        let barBotVal: number;
        if (p.kind === "hoy" || p.kind === "proyectado") {
          barTopVal = Math.max(0, p.saldoDespues);
          barBotVal = Math.min(0, p.saldoDespues);
        } else {
          barTopVal = Math.max(p.saldoAntes, p.saldoDespues);
          barBotVal = Math.min(p.saldoAntes, p.saldoDespues);
        }
        const yTop = yOf(barTopVal);
        const yBot = yOf(barBotVal);
        const barH = Math.max(3, yBot - yTop);
        const prev = pasos[i - 1];
        const valLabel =
          p.kind === "hoy" || p.kind === "proyectado"
            ? compacto(p.saldoDespues)
            : (p.monto > 0 ? "+" : "−") + compacto(Math.abs(p.monto)).replace("−", "");
        return (
          <g key={i}>
            {/* conector al saldo corriente anterior */}
            {prev && (
              <line
                x1={cxOf(i - 1) + bw / 2}
                y1={yOf(prev.saldoDespues)}
                x2={cx - bw / 2}
                y2={yOf(prev.saldoDespues)}
                stroke="var(--color-neutral-mid)"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.5"
              />
            )}
            <rect
              x={cx - bw / 2}
              y={yTop}
              width={bw}
              height={barH}
              rx="4"
              fill={col}
              opacity={p.kind === "hoy" || p.kind === "proyectado" ? 0.95 : 0.82}
            />
            <text
              x={cx}
              y={yTop - 6}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight="700"
              fill={col}
            >
              {valLabel}
            </text>
            <text
              x={cx}
              y={H - 30}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight="600"
              fill="var(--color-neutral-mid)"
            >
              {p.label}
            </text>
            {p.fechaLabel && (
              <text
                x={cx}
                y={H - 16}
                textAnchor="middle"
                fontSize="9.5"
                fill="var(--color-neutral-light)"
              >
                {p.fechaLabel}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
