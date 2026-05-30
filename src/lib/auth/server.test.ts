/* Tests de requireAuth() — guard para Server Components / route handlers.
   Si no hay sesión, redirige a /login (con redirect param opcional). Se
   mockean `auth` (la fuente de sesión) y `redirect` (en Next real lanza
   para abortar el render; acá el mock lanza para verificar que corta). */
import { afterEach, describe, expect, it, vi } from "vitest";

const { authMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  redirectMock: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));

vi.mock("./session", () => ({ auth: authMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { requireAuth } from "./server";

afterEach(() => {
  authMock.mockReset();
  redirectMock.mockClear();
});

describe("requireAuth", () => {
  it("devuelve la sesión cuando auth() la trae", async () => {
    const session = { user: { id: "1", email: "a@b.cl", role: "owner" } };
    authMock.mockResolvedValue(session);
    await expect(requireAuth()).resolves.toBe(session);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirige a /login con redirect param cuando no hay sesión", async () => {
    authMock.mockResolvedValue(null);
    await expect(requireAuth("/caja")).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/login?redirect=%2Fcaja");
  });

  it("redirige a /login sin param cuando no se pasa redirectTo", async () => {
    authMock.mockResolvedValue(null);
    await expect(requireAuth()).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});
