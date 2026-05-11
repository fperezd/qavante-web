import type { ReactNode } from "react";

type FormProps = {
  children: ReactNode;
};

export function Form({ children }: FormProps) {
  return <>{children}</>;
}
