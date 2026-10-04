"use client";

import * as React from "react";
import { formatMoney } from "@/lib/formatters/clp";
import { parseAmountOrNull } from "@/lib/formatters/amount";

/* Presentación COMPARTIDA de los bloques de resultado de /gestion.
 *
 * Esto NO es un rediseño: es el mismo marcado que ya tenía
 * `operational-result-v2-panel.tsx` (tarjetas, espaciado, tipografía, el chip de aptitud, la
 * línea de rango debajo del título), extraído para que el bloque de lo CORRIDO lo reuse en vez
 * de copiarlo. Si mañana se ajusta el espaciado, se ajusta en un solo lugar y los dos bloques
 * se mueven juntos — que es justamente lo que el dueño pidió: "las dos cosas con el formato
 * del front y el diseño que tiene actualmente el de resultado operacional".
 *
 * Los RÓTULOS no viven acá: viven en `@/lib/gestion-titulos` (fuente única, con test). */

/** String-decimal del backend → monto en pantalla. Un monto ilegible se DECLARA; nunca se
 *  convierte en $0 (un cero inventado sobre plata es peor que no publicar).
 *
 *  Nota de deuda conocida: devuelve el texto pelado "Sin dato" en vez del primitivo sancionado
 *  `<SinDato>` (Ley 8), que obliga a declarar el motivo. Se conserva TAL CUAL del panel original
 *  —y el test de ese panel lo fija— porque cambiarlo altera el diseño que el dueño aprobó y
 *  toca los dos bloques a la vez. Va en su propio PR. */
export function money(value: string): string {
  const amount = parseAmountOrNull(value);
  return amount === null ? "Sin dato" : formatMoney(amount, "CLP");
}

/** Suma de partes que SOLO se publica si todas las partes son legibles. Una suma parcial sobre
 *  plata es una cifra falsa con cara de cierta: si falta una parte, el total no se publica. */
export function moneySuma(parts: readonly string[]): string {
  let total = 0;
  for (const part of parts) {
    const amount = parseAmountOrNull(part);
    if (amount === null) return "Sin dato";
    total += amount;
  }
  return formatMoney(total, "CLP");
}

export interface ResultadoBloqueProps {
  /** Rótulo del bloque. Viene de `@/lib/gestion-titulos`, no de un string suelto. */
  titulo: string;
  /** Línea chica sobre el título ("Lo que ya ocurrió" / "Una definición para toda Qavante"). */
  eyebrow: string;
  /** QUÉ PERÍODO CUBRE: la razón de ser de este rediseño. Siempre se muestra. */
  periodo: string;
  /** Chip de aptitud para decidir. `undefined` → no se muestra (p.ej. bloque abstenido). */
  apto?: boolean;
  /** `id` del `<h2>` para `aria-labelledby` (distinto por bloque). */
  tituloId: string;
  children?: React.ReactNode;
}

/** Marco del bloque con cifras: cabecera (eyebrow + título + rango + chip) y el cuerpo. */
export function ResultadoBloque({
  titulo,
  eyebrow,
  periodo,
  apto,
  tituloId,
  children,
}: ResultadoBloqueProps) {
  return (
    <section
      className="space-y-4 rounded-xl border border-border bg-surface p-4"
      aria-labelledby={tituloId}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-mid">
            {eyebrow}
          </p>
          <h2 id={tituloId} className="mt-1 text-lg font-semibold text-neutral-dark">
            {titulo}
          </h2>
          <p className="mt-1 text-sm text-neutral-mid">{periodo}</p>
        </div>
        {apto !== undefined && (
          <span className="rounded-full bg-neutral-light px-3 py-1 text-xs font-semibold text-neutral-dark">
            {apto ? "Apto para decidir" : "Parcial · no usar para decidir"}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

/** Marco del bloque ABSTENIDO: mismo rótulo y mismo rango, sin cifras inventadas.
 *
 *  Este estado NO es excepcional: el productor del horizonte está abstenido en producción y va
 *  a seguir así un tiempo, así que la pantalla tiene que verse bien con un bloque con cifras y
 *  el otro abstenido AL MISMO TIEMPO. El borde ámbar y el `role="status"` vienen del panel
 *  original; lo único que cambia es que ahora también declara qué período cubre. */
export function ResultadoBloqueAbstenido({
  titulo,
  periodo,
  tituloId,
  children,
}: {
  titulo: string;
  periodo?: string;
  tituloId: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl border border-warning-500/30 bg-warning-500/5 p-4"
      role="status"
      aria-labelledby={tituloId}
    >
      <h2 id={tituloId} className="font-semibold text-neutral-dark">
        {titulo}
      </h2>
      {periodo && <p className="mt-1 text-sm text-neutral-mid">{periodo}</p>}
      <p className="mt-1 text-sm text-neutral-mid">{children}</p>
    </section>
  );
}

/** Tarjeta de métrica. Idéntica a la del panel original (`compact` para las filas secundarias). */
export function ResultadoMetric({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact ? "rounded-lg bg-neutral-light/30 p-2" : "rounded-lg bg-neutral-light/30 p-3"
      }
    >
      <dt className="text-xs text-neutral-mid">{label}</dt>
      <dd className="mt-1 font-semibold tabular-nums text-neutral-dark">{value}</dd>
    </div>
  );
}

/** Fila de 4 métricas grandes (la cabecera de cifras de los dos bloques). */
export function ResultadoMetricRow({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</dl>;
}

/** Fila de 4 métricas `compact` (la fila de abajo: sin clasificar / financieros / resultado). */
export function ResultadoMetricRowCompact({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

/** Sub-bloque enmarcado "Qué incluye Costo Directo" (base + remuneraciones + honorarios). */
export function ResultadoDesgloseCostoDirecto({
  base,
  remuneraciones,
  honorarios,
  nota,
}: {
  base: string;
  remuneraciones: string;
  honorarios: string;
  nota: string;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <h3 className="text-sm font-semibold text-neutral-dark">Qué incluye Costo Directo</h3>
      <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
        <ResultadoMetric label="Base" value={base} compact />
        <ResultadoMetric label="Remuneraciones" value={remuneraciones} compact />
        <ResultadoMetric label="Honorarios" value={honorarios} compact />
      </dl>
      <p className="mt-2 text-xs text-neutral-mid">{nota}</p>
    </div>
  );
}

/** Chips de frescura por fuente requerida (RCV, nómina, honorarios). */
export function ResultadoFuentes({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2 text-xs text-neutral-mid" aria-label="Cobertura de fuentes">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="rounded-full border border-border px-2 py-1">
          {item}
        </li>
      ))}
    </ul>
  );
}
