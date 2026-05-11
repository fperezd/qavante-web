import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const qavanteCardVariants = cva("rounded-lg bg-surface", {
  variants: {
    variant: {
      default: "shadow-sm",
      elevated: "shadow-md",
      bordered: "border border-neutral-light",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface QavanteCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof qavanteCardVariants> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export function QavanteCard({
  className,
  variant,
  header,
  footer,
  children,
  ...props
}: QavanteCardProps) {
  return (
    <div className={cn(qavanteCardVariants({ variant }), className)} {...props}>
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
