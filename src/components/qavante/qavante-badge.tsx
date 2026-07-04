import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const qavanteBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-neutral-light/40 text-neutral-dark",
        success: "bg-success-50 text-success-700",
        warning: "bg-warning-50 text-warning-700",
        danger: "bg-danger-50 text-danger-700",
        info: "bg-info-50 text-info-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface QavanteBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof qavanteBadgeVariants> {}

export function QavanteBadge({ className, variant, ...props }: QavanteBadgeProps) {
  return <span className={cn(qavanteBadgeVariants({ variant }), className)} {...props} />;
}
