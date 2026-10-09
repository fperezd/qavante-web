"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

const POPUP =
  "z-[100] w-[min(20rem,min(80vw,calc(100vw-2rem)))] rounded-xl border border-rediseno-hairline bg-rediseno-superficie p-3 text-left font-rediseno-sans text-[12.5px] leading-relaxed font-normal tracking-normal text-rediseno-tinta-2 normal-case shadow-lg outline-none";

const TRIGGER =
  "inline-flex shrink-0 self-center text-rediseno-tinta-3-light hover:text-rediseno-tinta-2 focus-visible:ring-2 focus-visible:ring-rediseno-azul focus-visible:outline-none";

export interface RedisenoInfoPopoverProps {
  /** Etiqueta accesible del botón ⓘ. */
  ariaLabel: string;
  children: React.ReactNode;
  className?: string;
}

/** Panel explicativo anclado al ⓘ, renderizado en portal (no queda recortado por overflow del padre). */
export function RedisenoInfoPopover({ ariaLabel, children, className }: RedisenoInfoPopoverProps) {
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  return (
    <Popover.Root
      onOpenChange={(open, details) => {
        /* Si Escape cierra con el foco fuera del panel, Base UI no devuelve el foco al trigger. */
        if (!open && details.reason === "escape-key") {
          queueMicrotask(() => triggerRef.current?.focus());
        }
      }}
    >
      <Popover.Trigger
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        className={cn(TRIGGER, className)}
      >
        <Info className="size-3.5" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} collisionPadding={12}>
          <Popover.Popup className={POPUP}>{children}</Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
