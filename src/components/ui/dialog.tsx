import type { ReactNode } from "react";

type DialogProps = {
  children: ReactNode;
};

export function Dialog({ children }: DialogProps) {
  return <div>{children}</div>;
}
