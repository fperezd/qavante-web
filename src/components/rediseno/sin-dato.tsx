"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { estaVacio, type ContenidoVisible } from "./contenido-visible";

/* «Sin dato» — el primitivo para decir NO SÉ. Rediseño §1.4 y Ley 8.
 *
 * Por qué existe: hoy la única forma que tiene el producto de expresar ausencia
 * de dato es un número, y el número miente. Cobrar muestra "0% vencido" cuando
 * en realidad no tiene la fuente de vencimientos (el backend lo declara en
 * `data_state:"partial"` + `missing_sources`, pero la pantalla lo pinta como un
 * cero tranquilizador). La regla del proyecto es que el "no sé" es un bucket
 * explícito, nunca un default plausible: si no lo sabemos, se ve distinto de un
 * cero y se puede preguntar por qué.
 *
 * Por qué NO es rojo (Ley 2): el rojo está reservado a lo crítico Y accionable,
 * máximo una vez por pantalla. Que falte una fuente no es una emergencia — es
 * información. Va en `tinta-3-light`, el mismo gris que usa el HTML de
 * referencia para "sin dato ⓘ" (qavante-ui.html, KPI "Pagas en (DPO)").
 *
 * Sobre el motivo, con precisión (Ley 8: siempre decir qué falta y por qué).
 * Un "sin dato" mudo es casi tan deshonesto como el cero que reemplaza — el
 * usuario queda sin saber si el problema es suyo, nuestro o del SII. Lo que el
 * compilador SÍ garantiza, verificado con `tsc`:
 *   - hay que declarar `reason` o `missingSources`; `<SinDato />` no compila;
 *   - `reason` no acepta `undefined`, `null` ni booleanos (ver
 *     `contenido-visible.ts`), así que no se puede "declarar" un motivo que
 *     renderiza la nada.
 * Lo que NO garantiza, y por eso existe el fallback de runtime de abajo:
 * `reason=""` y `missingSources={[]}` compilan. Expresar eso en el tipo exige
 * genéricos condicionales que rompen la inferencia en cada call site; en vez de
 * eso, si el motivo queda vacío el panel LO DICE en lugar de quedar mudo. */

export interface SinDatoMotivoBase {
  /** Motivo en lenguaje de dueño: "todavía no tenemos las fechas de vencimiento". */
  reason?: ContenidoVisible;
  /** `missing_sources` del backend, sin reescribir: si él dice qué falta, mandamos eso. */
  missingSources?: readonly string[];
}

/** Al menos uno de los dos motivos es obligatorio (Ley 8: siempre decir qué falta y por qué). */
export type SinDatoMotivo =
  | (SinDatoMotivoBase & { reason: ContenidoVisible })
  | (SinDatoMotivoBase & { missingSources: readonly string[] });

export type SinDatoProps = SinDatoMotivo & {
  /**
   * `inline` (default) → "sin dato". `compact` → "Sin información", para celdas de tabla
   * donde la columna es angosta y el texto largo rompería la grilla.
   */
  variant?: "inline" | "compact";
  /** Qué es lo que no sabemos, para el lector de pantalla: "el monto vencido". */
  label?: string;
  className?: string;
};

export function SinDato({
  reason,
  missingSources,
  variant = "inline",
  label,
  className,
}: SinDatoProps) {
  const [open, setOpen] = React.useState(false);
  const panelId = React.useId();
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const fuentes = missingSources?.filter((s) => s.trim().length > 0) ?? [];
  const queNoSabemos = label ? `${label}` : "este dato";
  /* El tipo no puede prohibir `reason=""` ni `missingSources={[]}` (ver el
     comentario de arriba). Cuando pasa, el panel dice que no tenemos el motivo:
     un "no sé por qué no sé" honesto es mejor que un recuadro vacío. */
  const sinMotivo = estaVacio(reason) && fuentes.length === 0;

  /* Escape cierra y devuelve el foco al ⓘ: sin esto, el usuario de teclado
     queda con el foco en un panel que ya no está. */
  React.useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <span className={cn("relative inline-flex items-baseline gap-1", className)}>
      <span className="font-rediseno-sans text-rediseno-tinta-3-light italic">
        {variant === "compact" ? "Sin información" : "sin dato"}
      </span>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`Por qué no sabemos ${queNoSabemos}`}
        className="inline-flex shrink-0 self-center text-rediseno-tinta-3-light hover:text-rediseno-tinta-2 focus-visible:ring-2 focus-visible:ring-rediseno-azul focus-visible:outline-none"
      >
        <Info className="size-3.5" aria-hidden />
      </button>
      {open && (
        <span
          id={panelId}
          role="tooltip"
          className="absolute top-full left-0 z-40 mt-1.5 block w-[min(19rem,80vw)] rounded-xl border border-rediseno-hairline bg-rediseno-superficie p-3 text-left font-rediseno-sans text-[12.5px] leading-relaxed font-normal tracking-normal text-rediseno-tinta-2 normal-case shadow-lg"
        >
          <span className="block font-semibold text-rediseno-tinta">
            No lo sabemos todavía · y preferimos decirlo antes que mostrarte un cero.
          </span>
          {!estaVacio(reason) && <span className="mt-1 block">{reason}</span>}
          {sinMotivo && (
            <span className="mt-1 block">
              No tenemos registrado el motivo. Es una falla nuestra, no algo que hayas hecho mal.
            </span>
          )}
          {fuentes.length > 0 && (
            <span className="mt-1 block text-rediseno-tinta-3">
              {fuentes.length === 1 ? "Fuente que falta: " : "Fuentes que faltan: "}
              <span className="text-rediseno-tinta-2">{fuentes.join(" · ")}</span>
            </span>
          )}
        </span>
      )}
    </span>
  );
}
