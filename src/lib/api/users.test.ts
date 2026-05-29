/* Tests del data layer users — sanity de query keys del repo. Anti-regresión
   ante cambios accidentales en el namespace de keys que romperían
   invalidación de cache + integraciones con react-query. */
import { describe, expect, it } from "vitest";
import { usersKeys } from "./users";

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
