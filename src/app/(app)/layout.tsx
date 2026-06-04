import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { auth } from "@/lib/auth/session";
import { resolveFeatureFlags } from "@/lib/feature-flags";

/* (app)/layout.tsx es server component — llama auth() (que lee la cookie con
   next/headers) y pasa el role al shell para gating del sidebar. Si auth()
   devuelve null el middleware ya redirigió a /login antes de llegar acá,
   pero defensa-en-profundidad: fallback a undefined → sidebar oculta
   Administración (default seguro). Resuelve `assistant` acá (server) para
   gatear el Asistente — el flag se lee en runtime del Worker (no client). */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const { assistant } = resolveFeatureFlags();
  return (
    <AppShell userRole={session?.user.role} assistantEnabled={assistant}>
      {children}
    </AppShell>
  );
}
