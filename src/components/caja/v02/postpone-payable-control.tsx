"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { PostponeDays } from "@/lib/api/pagos";

const SEGUNDOS_ARREPENTIMIENTO = 5;
const DIAS: readonly PostponeDays[] = [7, 15, 30];

export interface PostponePayableControlProps {
  payableId: string;
  glosa: string;
  onPostpone: (payableId: string, days: PostponeDays) => Promise<void>;
}

/**
 * Ventana de arrepentimiento de Ley 4 para mover un vencimiento. El POST no sale hasta que
 * termina la cuenta y Cancelar/Escape detienen el timer antes de toda mutación.
 */
export function PostponePayableControl({
  payableId,
  glosa,
  onPostpone,
}: PostponePayableControlProps) {
  const [menuAbierto, setMenuAbierto] = React.useState(false);
  const [seleccion, setSeleccion] = React.useState<PostponeDays | null>(null);
  const [restante, setRestante] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [listo, setListo] = React.useState(false);
  const onPostponeRef = React.useRef(onPostpone);
  onPostponeRef.current = onPostpone;

  const cancelar = React.useCallback(() => {
    setRestante(null);
    setSeleccion(null);
  }, []);

  React.useEffect(() => {
    if (restante == null || seleccion == null) return undefined;
    if (restante > 0) {
      const timer = window.setTimeout(() => setRestante((actual) => (actual ?? 1) - 1), 1000);
      return () => window.clearTimeout(timer);
    }
    setRestante(null);
    void (async () => {
      try {
        await onPostponeRef.current(payableId, seleccion);
        setListo(true);
        setSeleccion(null);
      } catch (causa) {
        setSeleccion(null);
        setError(causa instanceof Error ? causa.message : "No pudimos postergar este pago.");
      }
    })();
    return undefined;
  }, [payableId, restante, seleccion]);

  React.useEffect(() => {
    if (restante == null) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelar();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [cancelar, restante]);

  if (listo) {
    return (
      <p role="status" className="text-[12px] text-rediseno-tinta-2">
        Fecha actualizada. Refrescando proyecciÃ³n.
      </p>
    );
  }

  if (restante != null && seleccion != null) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <p role="status" aria-live="polite" className="text-[12px] text-rediseno-tinta-2">
          Postergaremos {glosa} {seleccion} dÃ­as en {restante} s.
        </p>
        <button type="button" onClick={cancelar} className={BOTON_SECUNDARIO}>
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {menuAbierto ? (
        <>
          {DIAS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => {
                setError(null);
                setSeleccion(days);
                setRestante(SEGUNDOS_ARREPENTIMIENTO);
              }}
              className={BOTON_SECUNDARIO}
            >
              {days} dÃ­as
            </button>
          ))}
          <button type="button" onClick={() => setMenuAbierto(false)} className={BOTON_SECUNDARIO}>
            Cerrar
          </button>
        </>
      ) : (
        <button
          type="button"
          data-postergar="true"
          onClick={() => setMenuAbierto(true)}
          className={BOTON_PRIMARIO}
        >
          Postergar â–¾
        </button>
      )}
      {error && (
        <p
          role="alert"
          className="basis-full text-right text-[12px] font-semibold text-rediseno-ambar"
        >
          No pudimos postergar: {error}
        </p>
      )}
    </div>
  );
}

const BOTON_PRIMARIO = cn(
  "rounded-full border border-rediseno-azul px-2.5 py-1 text-[12px] font-semibold text-rediseno-azul",
  "hover:bg-rediseno-azul/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul",
);
const BOTON_SECUNDARIO = cn(
  "rounded-full border border-rediseno-hairline px-2.5 py-1 text-[12px] font-semibold text-rediseno-tinta-2",
  "hover:bg-rediseno-neutro-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul",
);
