import * as React from "react";
import { cn } from "../lib/cn";

/* SourceTag — etiqueta de origen de un dato. AGNÓSTICO: recibe la metadata por
   prop (`label` + clases). El catálogo de fuentes (su lista y colores) lo define
   cada app — el componente solo presenta. */
export interface SourceMeta {
  label: string;
  /** Clases de color (ej. "bg-brand-primary-50 text-brand-primary-700"). */
  className?: string;
}

export interface SourceTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  meta: SourceMeta;
}

export function SourceTag({ meta, className, ...props }: SourceTagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-current/10 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide",
        meta.className,
        className,
      )}
      {...props}
    >
      {meta.label}
    </span>
  );
}
