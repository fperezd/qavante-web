"use client";

import * as React from "react";
import { cn } from "../lib/cn";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

/* Bloque de carga: una forma que ANTICIPA el contenido real, no un spinner. */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-neutral-light/30", className)}
      {...props}
    />
  );
}
