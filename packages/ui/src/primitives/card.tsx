"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const cardVariants = cva("rounded-xl bg-surface transition-shadow", {
  variants: {
    variant: {
      default: "border border-border shadow-sm",
      elevated: "shadow-lg",
      bordered: "border border-border",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export function Card({ className, variant, header, footer, children, ...props }: CardProps) {
  return (
    <div className={cn(cardVariants({ variant }), className)} {...props}>
      {header && (
        <div className="border-b border-neutral-light/60 px-5 py-3 text-sm font-semibold text-neutral-dark">
          {header}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
      {footer && (
        <div className="border-t border-neutral-light/60 px-5 py-3 text-sm text-neutral-mid">
          {footer}
        </div>
      )}
    </div>
  );
}
