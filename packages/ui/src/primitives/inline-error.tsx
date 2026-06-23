"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "../lib/cn";

/* InlineError — alerta inline AGNÓSTICA. Recibe el mensaje ya resuelto: no
   conoce ninguna API ni mapea errores de un backend. El mapeo error→texto lo
   hace cada app antes de pasar `message`. */
export interface InlineErrorProps extends React.HTMLAttributes<HTMLDivElement> {
  message: string;
}

export function InlineError({ message, className, ...rest }: InlineErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-neutral-dark",
        className,
      )}
      {...rest}
    >
      <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-500" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
