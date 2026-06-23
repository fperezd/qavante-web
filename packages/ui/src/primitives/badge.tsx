"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-neutral-light/40 text-neutral-dark",
        success: "bg-success-500/15 text-success-500",
        warning: "bg-warning-500/15 text-warning-500",
        danger: "bg-danger-500/15 text-danger-500",
        info: "bg-info-500/15 text-info-500",
        brand: "bg-brand-primary-50 text-brand-primary-700",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
