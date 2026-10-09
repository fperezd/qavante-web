"use client";

import type { ReactNode } from "react";
import { CompanyScopeProvider } from "@/components/shell/company-scope";

/* Pasos post-auth del wizard: monedas, banco, etc. necesitan sociedad activa
   (header `X-Qavante-Company-Id` + PUT moneda funcional por legal entity). */
export default function OnboardingPostAuthLayout({ children }: { children: ReactNode }) {
  return <CompanyScopeProvider>{children}</CompanyScopeProvider>;
}
