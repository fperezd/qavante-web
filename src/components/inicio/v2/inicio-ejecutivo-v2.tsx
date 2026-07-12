import * as React from "react";
import { cn } from "@/lib/utils";
import { PulsoCard, type PulsoCardProps } from "./pulso-card";
import { Termometros, type Termometro } from "./termometros";

/* InicioEjecutivoV2 — shell de composición del rediseño aprobado. Ensambla, en el
   orden del recorrido del dueño: frase (contexto) → 3 termómetros (las preguntas) →
   cockpit (Pulso + plan) → grid de detalle → calidad de dato.

   `plan` y las tarjetas del `grid` entran como slots (crisis usa BrechaPlan; sana/
   control una lista de acciones). En la app las tarjetas del grid serán reordenables
   por el gerente (drag) con persistencia por user-prefs; acá el orden es fijo. El
   diagnóstico y el plan quedan SIEMPRE arriba (baranda: no se ocultan). */

export interface InicioEjecutivoV2Props {
  frase: React.ReactNode;
  termometros: Termometro[];
  pulso: PulsoCardProps;
  /** <BrechaPlan/> en crisis, o la lista de acciones en sana/control. */
  plan: React.ReactNode;
  /** Las 4 tarjetas de detalle (Caja · Cobranza · Pagos · Resultado). */
  grid: React.ReactNode[];
  calidad?: React.ReactNode;
  className?: string;
}

export function InicioEjecutivoV2({
  frase,
  termometros,
  pulso,
  plan,
  grid,
  calidad,
  className,
}: InicioEjecutivoV2Props) {
  return (
    <div className={cn("space-y-4", className)}>
      <p className="max-w-[66ch] text-[15px] font-medium leading-relaxed text-neutral-dark sm:text-base">
        {frase}
      </p>

      <Termometros items={termometros} />

      <div className="grid items-stretch gap-3.5 lg:grid-cols-2">
        <PulsoCard {...pulso} />
        {plan}
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {grid.map((card, i) => (
          <React.Fragment key={i}>{card}</React.Fragment>
        ))}
      </div>

      {calidad}
    </div>
  );
}
