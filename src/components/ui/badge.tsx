import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
};

export function Badge({ children }: BadgeProps) {
  return <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">{children}</span>;
}
