import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { auth } from "@/lib/auth/session";

/* (app)/layout.tsx es server component — llama auth() (que lee la cookie con
   next/headers) y pasa el role al shell para gating del sidebar. Si auth()
   devuelve null el middleware ya redirigió a /login antes de llegar acá,
   pero defensa-en-profundidad: fallback a undefined → sidebar oculta
   Administración (default seguro). */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  return <AppShell userRole={session?.user.role}>{children}</AppShell>;
}
