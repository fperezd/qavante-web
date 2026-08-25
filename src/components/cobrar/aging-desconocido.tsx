import { HelpCircle } from "lucide-react";
import type { VencidoSinDato } from "./cobranza-format";

/* Estado "no se sabe" de la antigüedad de saldos (hallazgo H6).
 *
 * Cuando la API no puede computar los tramos de mora, devuelve `null`
 * (qavante-api#123). Antes el front aplastaba ese null a 0 y la barra apilada
 * quedaba 100% "Vigente": la pantalla afirmaba "todo al día" precisamente cuando
 * no sabía nada. Esta pieza reemplaza esa barra tranquilizadora por una franja
 * rayada, neutra y sin porcentajes — desconocimiento que SE VE — más el porqué y
 * el qué hacer.
 *
 * Presentacional pura (ADR-0018): sin fetch, sin estado; se testea por story. */

export interface AgingDesconocidoProps {
  /** Motivo + acción, de `explicarVencidoSinDato` (contrato #123). */
  sinDato: VencidoSinDato;
}

/** Franja neutra rayada que ocupa el lugar de la barra apilada. Sin `width:%` por
 *  tramo: no hay porcentajes que pintar. */
export function AgingBarraDesconocida() {
  return (
    <div
      role="img"
      aria-label="Antigüedad de saldos no disponible"
      title="Antigüedad de saldos no disponible"
      className="h-3 w-full rounded-full border border-dashed border-border-strong bg-[repeating-linear-gradient(45deg,var(--color-neutral-light)_0_6px,transparent_6px_12px)] opacity-70"
    />
  );
}

/** Explicación accionable bajo la franja: QUÉ pasa, POR QUÉ y QUÉ hacer. */
export function AgingDesconocido({ sinDato }: AgingDesconocidoProps) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-dashed border-border bg-surface-muted/40 p-3">
      <HelpCircle className="mt-0.5 size-4 shrink-0 text-neutral-mid" aria-hidden="true" />
      <div className="space-y-1 text-[12.5px] leading-relaxed">
        <p className="font-semibold text-neutral-dark">{sinDato.motivo}</p>
        <p className="text-neutral-mid">{sinDato.accion}</p>
      </div>
    </div>
  );
}
