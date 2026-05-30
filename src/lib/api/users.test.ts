/* Tests del data layer users — sanity de query keys del repo. Anti-regresión
   ante cambios accidentales en el namespace de keys que romperían
   invalidación de cache + integraciones con react-query. */
import { describe, expect, it } from "vitest";
import { handleLogoutError, usersKeys } from "./users";
import { ApiError } from "./errors";

describe("usersKeys", () => {
  it("all es ['users']", () => {
    expect(usersKeys.all).toEqual(["users"]);
  });

  it("list namespaced y varía por params", () => {
    const a = usersKeys.list({ page: 1 });
    const b = usersKeys.list({ page: 2 });
    expect(a[0]).toBe("users");
    expect(a[1]).toBe("list");
    expect(a).not.toEqual(b);
  });

  it("me es estable y namespaced", () => {
    expect(usersKeys.me()).toEqual(["users", "me"]);
  });

  it("me key es distinto a list key (no colisiona)", () => {
    expect(usersKeys.me()).not.toEqual(usersKeys.list({}));
  });
});

describe("handleLogoutError — 401 es éxito funcional", () => {
  it("traga el 401: la sesión ya estaba inválida, el logout ya se cumplió", () => {
    const err = new ApiError("Sesión expirada", 401, "unauthorized");
    expect(() => handleLogoutError(err)).not.toThrow();
    expect(handleLogoutError(err)).toBeUndefined();
  });

  it("re-lanza errores ApiError que no son 401 (ej. 500)", () => {
    const err = new ApiError("Boom", 500, "server_error");
    expect(() => handleLogoutError(err)).toThrow(err);
  });

  it("re-lanza errores que no son ApiError (ej. red caída)", () => {
    const err = new Error("network down");
    expect(() => handleLogoutError(err)).toThrow(err);
  });
});
