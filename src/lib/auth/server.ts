import { redirect } from "next/navigation";
import { loginPathWithRedirect } from "./routes";
import { auth } from "./session";
import type { SessionData } from "./types";

/* Helpers para usar en Server Components / Server Actions / route handlers.
   Si la sesión no es válida, redirige al login principal con redirect param.
   Útil cuando una página necesita garantizar usuario logueado server-side
   (no solo bajo el matcher del middleware). */

export async function requireAuth(redirectTo?: string): Promise<SessionData> {
  const session = await auth();
  if (!session) {
    redirect(loginPathWithRedirect(redirectTo));
  }
  return session;
}
