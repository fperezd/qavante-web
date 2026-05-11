"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const qavanteButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-primary disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-brand-primary text-surface hover:bg-brand-primary-600 active:bg-brand-primary-700",
        secondary: "bg-brand-primary-50 text-brand-primary-700 hover:bg-brand-primary-100",
        ghost: "text-neutral-dark hover:bg-brand-primary-50",
        danger: "bg-danger-500 text-surface hover:bg-danger-500/90",
        link: "text-brand-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface QavanteButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof qavanteButtonVariants> {
  loading?: boolean;
}

export function QavanteButton({
  className,
  variant,
  size,
  loading = false,
  disabled,
  children,
  ...props
}: QavanteButtonProps) {
  return (
    <button
      className={cn(qavanteButtonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
