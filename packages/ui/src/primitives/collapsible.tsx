"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";

/* Collapsible — disclosure accesible (expandir/ocultar). Controlado o no
   controlado. `aria-expanded` + `aria-controls`; animación grid 0fr→1fr. */
export interface CollapsibleProps {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function Collapsible({
  title,
  children,
  defaultOpen = false,
  open,
  onOpenChange,
  className,
}: CollapsibleProps) {
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isOpen = isControlled ? open : internalOpen;
  const regionId = `${React.useId()}-region`;

  const toggle = () => {
    const next = !isOpen;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-surface", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls={regionId}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-neutral-dark transition-colors hover:bg-brand-primary-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
      >
        {title}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-neutral-mid transition-transform duration-200",
            isOpen && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      <div
        id={regionId}
        role="region"
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-4 pb-4 text-sm text-neutral-mid">{children}</div>
        </div>
      </div>
    </div>
  );
}
