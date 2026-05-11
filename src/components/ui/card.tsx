import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
};

export function Card({ children }: CardProps) {
  return <div className="rounded-lg border border-neutral-200 bg-white p-4">{children}</div>;
}
