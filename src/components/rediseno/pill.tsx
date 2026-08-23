import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* Pill de estado — ESPECIFICACION.md §1.3 "Pills de estado" (`.pillp`).
 * "Un solo sistema en toda la app": estas 5 variantes son las únicas que el
 * spec define. No agregar variantes nuevas sin actualizar el spec primero. */
const pillVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10.5px] font-bold tracking-[.03em]",
  {
    variants: {
      variant: {
        ok: "bg-rediseno-verde-soft text-rediseno-verde",
        warn: "bg-rediseno-ambar-soft text-rediseno-ambar",
        bad: "bg-rediseno-rojo-soft text-rediseno-rojo",
        mut: "bg-rediseno-neutro-bg text-rediseno-neutro-text",
        blue: "bg-rediseno-azul/10 text-rediseno-azul",
      },
    },
    defaultVariants: {
      variant: "mut",
    },
  },
);

export interface PillProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof pillVariants> {}

export function Pill({ className, variant, ...props }: PillProps) {
  return <span className={cn(pillVariants({ variant }), className)} {...props} />;
}
