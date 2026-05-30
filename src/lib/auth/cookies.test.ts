/* El nombre de la cookie de sesión es un contrato compartido entre
   middleware.ts, src/lib/auth/session.ts y el backend FastAPI (que la
   setea en /api/auth/login). Si cambia de un lado y no del otro, el
   gating de rutas se rompe en silencio. Este test lo fija. */
import { describe, expect, it } from "vitest";
import { SESSION_COOKIE_NAME } from "./cookies";

describe("SESSION_COOKIE_NAME", () => {
  it("es 'qavante_session' (contrato FE middleware ↔ backend)", () => {
    expect(SESSION_COOKIE_NAME).toBe("qavante_session");
  });
});
