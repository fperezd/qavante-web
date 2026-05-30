/* Tests de auth() — gating server-side de sesión (C0 placeholder hasta
   GET /api/me de C0-11). Cubre el contrato actual Y el boundary de
   seguridad del override de rol de testing: la cookie `qavante_test_role`
   SÓLO debe aplicar cuando NEXT_PUBLIC_API_MOCKING==="enabled" (dev/E2E),
   nunca en prod. Si esa guarda se rompe, un atacante podría auto-asignarse
   rol owner via cookie — por eso vale fijarlo con tests.

   `next/headers` se mockea (server-only); el mock fn se crea con vi.hoisted
   para que esté disponible cuando vi.mock se eleva por encima de los imports. */
import { afterEach, describe, expect, it, vi } from "vitest";

const { cookieGet } = vi.hoisted(() => ({ cookieGet: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
}));

import { auth } from "./session";

function setCookies(map: Record<string, string | undefined>) {
  cookieGet.mockImplementation((name: string) =>
    map[name] !== undefined ? { value: map[name] } : undefined,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  cookieGet.mockReset();
});

describe("auth() — sesión server-side", () => {
  it("sin cookie de sesión devuelve null", async () => {
    setCookies({});
    expect(await auth()).toBeNull();
  });

  it("con cookie de sesión devuelve SessionData (role owner por default)", async () => {
    setCookies({ qavante_session: "tok" });
    const s = await auth();
    expect(s).not.toBeNull();
    expect(s!.user.role).toBe("owner");
    expect(s!.user.id).toBe("placeholder");
    expect(s!.user.email).toBe("placeholder@qavante.com");
  });
});

describe("auth() — override de rol de testing (boundary de seguridad)", () => {
  it("IGNORA qavante_test_role si NEXT_PUBLIC_API_MOCKING no está enabled (prod)", async () => {
    /* El test runner corre con NEXT_PUBLIC_API_MOCKING=enabled (MSW), así
       que para simular prod hay que sacarlo explícitamente. */
    vi.stubEnv("NEXT_PUBLIC_API_MOCKING", undefined);
    setCookies({ qavante_session: "tok", qavante_test_role: "admin" });
    const s = await auth();
    expect(s!.user.role).toBe("owner");
  });

  it("aplica qavante_test_role cuando mocking enabled y el role es válido", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MOCKING", "enabled");
    setCookies({ qavante_session: "tok", qavante_test_role: "finance_manager" });
    const s = await auth();
    expect(s!.user.role).toBe("finance_manager");
  });

  it("cae a owner si el role de la cookie es inválido (no está en VALID_ROLES)", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MOCKING", "enabled");
    setCookies({ qavante_session: "tok", qavante_test_role: "superadmin" });
    const s = await auth();
    expect(s!.user.role).toBe("owner");
  });

  it("cae a owner si hay sesión pero no hay cookie test-role (mocking enabled)", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MOCKING", "enabled");
    setCookies({ qavante_session: "tok" });
    const s = await auth();
    expect(s!.user.role).toBe("owner");
  });
});
