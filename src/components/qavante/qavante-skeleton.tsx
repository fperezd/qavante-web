import * as React from "react";
import { cn } from "@/lib/utils";

export type QavanteSkeletonProps = React.HTMLAttributes<HTMLDivElement>;

/* Bloque de carga (Tooxs Design System Premium §8): una forma que ANTICIPA el
   contenido real, no un spinner genérico. Se componen varios para armar el
   esqueleto de una vista (ver AsyncBoundary). `aria-hidden` porque no aporta
   información al lector de pantalla (el contenedor usa `aria-busy`). */
export function QavanteSkeleton({ className, ...props }: QavanteSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-neutral-light/30", className)}
      {...props}
    />
  );
}
