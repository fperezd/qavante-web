import { describe, expect, it } from "vitest";
import { oauthRegistroPath } from "./auth-callback-view";
import { ApiError } from "@/lib/api/errors";

describe("oauthRegistroPath", () => {
  it("arma /registro con email y nombre del callback Auth0", () => {
    const err = new ApiError("sin cuenta", 401, "oauth_user_not_found", {
      detail: { code: "oauth_user_not_found", email: "ana@gmail.com", name: "Ana Pérez" },
    });
    expect(oauthRegistroPath(err)).toBe(
      "/registro?email=ana%40gmail.com&oauth=1&nombre=Ana+P%C3%A9rez",
    );
  });

  it("no redirige si el error es pending verification", () => {
    const err = new ApiError("pendiente", 401, "oauth_pending_verification", {
      detail: { code: "oauth_pending_verification", email: "ana@gmail.com" },
    });
    expect(oauthRegistroPath(err)).toBeNull();
  });
});
