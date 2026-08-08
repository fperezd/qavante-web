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
  /** Opcional: si el bloque Pulso no vino, el cockpit muestra solo el plan. */
  pulso?: PulsoCardProps;
  /** <BrechaPlan/> en crisis, o la lista de acciones en sana/control. */
  plan: React.ReactNode;
  /** Las 4 tarjetas de detalle (Caja · Cobranza · Pagos · Resultado). Cada elemento DEBE traer
   *  su `key` estable (por id de widget, no por índice): la grilla es reordenable y con keys de
   *  índice React desmonta/remonta las tarjetas movidas, y el foco del teclado se pierde. */
  grid: React.ReactNode[];
  /** Control "Personalizar" (prender/apagar tarjetas), gated `inicioWidgets`. Se ancla arriba del
   *  grid, alineado a la derecha. */
  personalizar?: React.ReactNode;
  calidad?: React.ReactNode;
  className?: string;
}

export function InicioEjecutivoV2({
  frase,
  termometros,
  pulso,
  plan,
  grid,
  personalizar,
  calidad,
  className,
}: InicioEjecutivoV2Props) {
  return (
    <div className={cn("space-y-4", className)}>
      <p className="max-w-[66ch] text-[15px] font-medium leading-relaxed text-neutral-dark sm:text-base">
        {frase}
      </p>

      <Termometros items={termometros} />

      <div className={cn("grid items-stretch gap-3.5", pulso && "lg:grid-cols-2")}>
        {pulso && <PulsoCard {...pulso} />}
        {plan}
      </div>

      {personalizar}

      {/* Se renderea el array tal cual: cada tarjeta ya trae su key estable (w.id). Envolverlas
          en un Fragment con key={i} descartaba esas keys y remontaba todo al reordenar. */}
      <div className="grid gap-3.5 sm:grid-cols-2">{grid}</div>

      {calidad}
    </div>
  );
}
