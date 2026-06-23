import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "../lib/cn";

export interface EmptyProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  cta?: React.ReactNode;
}

export function Empty({
  icon: Icon = Inbox,
  title,
  description,
  cta,
  className,
  ...props
}: EmptyProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-gradient-surface px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary-50 text-brand-primary">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-neutral-dark">{title}</h3>
      {description && <p className="max-w-md text-sm text-neutral-mid">{description}</p>}
      {cta && <div className="mt-2">{cta}</div>}
    </div>
  );
}
