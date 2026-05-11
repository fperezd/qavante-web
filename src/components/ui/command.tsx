import type { ReactNode } from "react";

type CommandProps = {
  children: ReactNode;
};

export function Command({ children }: CommandProps) {
  return <div>{children}</div>;
}
