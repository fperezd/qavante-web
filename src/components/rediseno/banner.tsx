import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* Banner accionable — ESPECIFICACION.md §1.3 "Banner accionable" (`.band`).
 * Border-left 3px (azul default, ámbar `.warn`, verde), 1 mensaje + 1 CTA pill
 * oscura. Dismissible SOLO cuando es contextual (no cuando es estructural del
 * flujo, ej. "tu proyección está incompleta" no se descarta). */
const bannerVariants = cva(
  "flex flex-wrap items-center gap-3 rounded-xl border border-rediseno-hairline bg-rediseno-superficie px-4 py-3 text-[13.5px] text-rediseno-tinta-2",
  {
    variants: {
      variant: {
        default: "border-l-[3px] border-l-rediseno-azul",
        warn: "border-l-[3px] border-l-rediseno-ambar-border",
        ok: "border-l-[3px] border-l-rediseno-verde",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BannerAction {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

export interface BannerProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof bannerVariants> {
  /** CTA principal, se renderiza como pill oscura alineada a la derecha. */
  action?: BannerAction;
  /** CTA secundaria, link azul sin fondo (ej. "Ver el cálculo"). */
  ghostAction?: BannerAction;
  /** Solo para banners contextuales, nunca estructurales del flujo (Ley: sin dismiss mudo). */
  dismissible?: boolean;
  onDismiss?: () => void;
}

export function Banner({
  className,
  variant,
  action,
  ghostAction,
  dismissible,
  onDismiss,
  children,
  ...props
}: BannerProps) {
  return (
    <div className={cn(bannerVariants({ variant }), className)} {...props}>
      <div className="min-w-0 flex-1">{children}</div>
      {ghostAction && (
        <button
          type="button"
          onClick={ghostAction.onClick}
          className="text-[12.5px] font-bold text-rediseno-azul"
        >
          {ghostAction.label}
        </button>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          className="ml-auto shrink-0 whitespace-nowrap rounded-full bg-rediseno-tinta px-4 py-2 text-[12.5px] font-bold text-white disabled:cursor-wait disabled:opacity-60"
        >
          {action.label}
        </button>
      )}
      {dismissible && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Descartar"
          className="shrink-0 text-rediseno-tinta-3 hover:text-rediseno-tinta"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
