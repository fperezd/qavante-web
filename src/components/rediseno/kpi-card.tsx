import * as React from "react";
import { cn } from "@/lib/utils";
import { SinDato, type SinDatoMotivo } from "./sin-dato";
import type { ContenidoVisible } from "./contenido-visible";

/* Tarjeta KPI — ESPECIFICACION.md §1.3 "Tarjeta KPI" (`.kp` en `.kpi3/.k4/.k5`).
 * Label mono uppercase + valor Fraunces + detalle. Selector de período opcional
 * (`.per`) a la derecha del label. Cifras SIEMPRE con `tabular-nums` (§1.2). */

interface KpiCardBaseProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  label: string;
  /** Chip de período a la derecha del label, ej. "BICE · 00:12 ✓" o "14 días ▾". */
  period?: string;
  /** ok = verde, bad = rojo (Ley 2: rojo solo crítico y accionable). */
  tone?: "default" | "ok" | "bad";
  detail?: React.ReactNode;
}

/* O hay una cifra, o hay un "no sé" con su motivo — nunca las dos, y nunca
 * ninguna.
 *
 * Lo que la unión garantiza (verificado con `tsc --noEmit`):
 *   - `<KpiCard label="x" />` no compila: hay que dar `value` o `sinDato`;
 *   - pasar los dos a la vez no compila;
 *   - `sinDato={{}}` no compila: hay que declarar un motivo;
 *   - `value` es `ContenidoVisible`, así que `undefined`/`null`/booleanos no
 *     compilan — el slot del valor no puede quedar vacío por accidente.
 *
 * Lo que NO garantiza, y conviene decirlo en vez de prometerlo: `value="$0"`
 * compila, y DEBE compilar — cuando el valor realmente es cero, "$0" es la
 * verdad. El compilador no puede distinguir un cero real de un cero inventado;
 * lo que hace la unión es que *omitir* el valor cueste escribir el motivo, y
 * que ya no exista la salida silenciosa de mandar `undefined`. Elegir "$0" a
 * sabiendas de que el dato no llegó sigue siendo una decisión humana, y esa la
 * atrapa la revisión, no el tipo. Tampoco atrapa cadenas vacías (ver
 * `contenido-visible.ts` para por qué no vale el precio). */
export type KpiCardProps = KpiCardBaseProps &
  ({ value: ContenidoVisible; sinDato?: never } | { value?: never; sinDato: SinDatoMotivo });

export function KpiCard(props: KpiCardProps) {
  const { label, period, value, sinDato, tone = "default", detail, className, ...rest } = props;
  return (
    <div
      className={cn(
        "rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie px-[17px] py-3.5",
        className,
      )}
      {...rest}
    >
      <div className="flex items-baseline gap-2 font-rediseno-mono text-[12px] tracking-[.1em] text-rediseno-tinta-3-light uppercase">
        <span>{label}</span>
        {period && (
          <span className="ml-auto rounded-md bg-rediseno-porcelana px-[7px] py-px font-rediseno-sans text-[12px] tracking-normal text-rediseno-tinta-3 normal-case">
            {period}
          </span>
        )}
      </div>
      <div
        className={cn(
          "mt-1.5 font-rediseno-sans text-[21px] font-medium tabular-nums",
          /* Un "no sé" no se colorea: verde o rojo sobre una ausencia sería un
             veredicto sobre un dato que no tenemos (Ley 2). El `tone` se ignora
             a propósito cuando la tarjeta va en `sinDato`. */
          sinDato && "text-rediseno-tinta-3-light",
          !sinDato && tone === "ok" && "text-rediseno-verde",
          !sinDato && tone === "bad" && "text-rediseno-rojo",
          !sinDato && tone === "default" && "text-rediseno-tinta",
        )}
      >
        {sinDato ? <SinDato label={label.toLowerCase()} {...sinDato} /> : value}
      </div>
      {detail && <div className="mt-0.5 text-[12px] text-rediseno-tinta-3-light">{detail}</div>}
    </div>
  );
}
