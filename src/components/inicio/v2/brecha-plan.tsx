import * as React from "react";
import { cn } from "@/lib/utils";
import { formatClp } from "@/lib/formatters/clp";

/* Plan de cierre de brecha (Inicio Ejecutivo v2). Reemplaza a "Qué hacer primero"
   en el escenario de crisis: no es una lista de recomendaciones, sino un plan que
   DEMUESTRA si las acciones alcanzan a cubrir la brecha. Cada acción trae impacto,
   fecha, estado y la BRECHA RESTANTE corriendo; el pie separa lo identificado de lo
   asegurado. Presentacional puro (props ya resueltas por el data layer). */

/** Estado de cada acción — NO usar "certeza": una cobranza no está "confirmada"
 *  salvo que haya un pago real; la banda alta del comportamiento de pago es
 *  "probable". El orden refleja fuerza decreciente de compromiso. */
export type BrechaEstado =
  | "ejecutada"
  | "confirmada"
  | "probable"
  | "en_negociacion"
  | "por_evaluar";

const ESTADO_LABEL: Record<BrechaEstado, string> = {
  ejecutada: "Ejecutada",
  confirmada: "Confirmada",
  probable: "Probable",
  en_negociacion: "En negociación",
  por_evaluar: "Por evaluar",
};

const ESTADO_TEXT: Record<BrechaEstado, string> = {
  ejecutada: "text-success-700",
  confirmada: "text-success-700",
  probable: "text-success-700",
  en_negociacion: "text-warning-700",
  por_evaluar: "text-neutral-mid",
};

function estadoValue<T>(rec: Record<BrechaEstado, T>, estado: BrechaEstado): T {
  return (rec as Record<string, T>)[estado] ?? rec.por_evaluar;
}

export interface BrechaAccion {
  titulo: string;
  /** CLP que aporta la acción (positivo). */
  impacto: number;
  /** Plazo legible ("7 días", "14 días"). */
  fecha: string;
  estado: BrechaEstado;
  /** Brecha que queda DESPUÉS de esta acción (negativo = sigue faltando; 0 = cubierta). */
  brechaRestante: number;
  /** Matiz honesto: "si se aprueba" cuando el cierre depende de una acción no asegurada. */
  restanteNota?: string;
}

export interface BrechaPlanProps {
  /** Brecha total a cubrir (positivo). */
  brechaTotal: number;
  acciones: BrechaAccion[];
  /** Suma de las acciones con estado alto/medio (lo realmente identificado). */
  coberturaIdentificada: number;
  /** Lo que aún NO está asegurado (positivo). */
  pendienteAsegurar: number;
  className?: string;
}

export function BrechaPlan({
  brechaTotal,
  acciones,
  coberturaIdentificada,
  pendienteAsegurar,
  className,
}: BrechaPlanProps) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-xl border border-border bg-surface shadow-sm",
        className,
      )}
      aria-label={`Plan para cubrir la brecha de ${formatClp(brechaTotal)}`}
    >
      <header className="px-5 pb-2 pt-4">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-mid">
          Plan para cubrir la brecha de{" "}
          <span className="text-neutral-dark">{formatClp(brechaTotal)}</span>
        </h3>
      </header>

      <ol className="flex-1">
        {acciones.map((a, i) => (
          <li
            key={i}
            className="flex items-center gap-3 border-t border-border px-5 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-dark">{a.titulo}</p>
              <p className="mt-0.5 text-xs text-neutral-mid">
                Impacto{" "}
                <span className="font-bold tabular-nums text-neutral-dark">
                  +{formatClp(a.impacto)}
                </span>{" "}
                · {a.fecha} ·{" "}
                <span className={cn("font-bold", estadoValue(ESTADO_TEXT, a.estado))}>
                  {estadoValue(ESTADO_LABEL, a.estado)}
                </span>
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[9.5px] font-bold uppercase tracking-wide text-neutral-mid">
                Brecha restante
              </p>
              <p
                className={cn(
                  "mt-0.5 text-sm font-bold tabular-nums",
                  a.brechaRestante < 0 ? "text-danger-500" : "text-success-700",
                )}
              >
                {formatClp(a.brechaRestante)}
                {a.restanteNota ? (
                  <span className="font-normal text-neutral-mid"> {a.restanteNota}</span>
                ) : null}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t-2 border-border-strong px-5 py-3 text-xs text-neutral-mid">
        <span>
          Cobertura identificada (certeza alta/media){" "}
          <span className="font-bold tabular-nums text-neutral-dark">
            {formatClp(coberturaIdentificada)}
          </span>
        </span>
        <span>
          Pendiente de asegurar{" "}
          <span className="font-bold tabular-nums text-danger-500">
            {formatClp(pendienteAsegurar)}
          </span>
        </span>
      </footer>
    </section>
  );
}
