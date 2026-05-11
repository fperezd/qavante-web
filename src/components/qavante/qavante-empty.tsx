import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QavanteEmptyProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  cta?: React.ReactNode;
}

export function QavanteEmpty({
  icon: Icon = Inbox,
  title,
  description,
  cta,
  className,
  ...props
}: QavanteEmptyProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-neutral-light bg-surface px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      <Icon className="h-10 w-10 text-neutral-mid" aria-hidden="true" />
      <h3 className="text-base font-semibold text-neutral-dark">{title}</h3>
      {description && <p className="max-w-md text-sm text-neutral-mid">{description}</p>}
      {cta && <div className="mt-2">{cta}</div>}
    </div>
  );
}
