import { describe, expect, it } from "vitest";
import { parseUserMessage, renderUserMessage } from "./user-message";

describe("UserMessage", () => {
  it("acepta sólo códigos, params y correlation_id enumerados", () => {
    expect(
      parseUserMessage({
        message_code: "invalid_field",
        params: { field: "email", ignored: "no se propaga" },
        correlation_id: "req.123:abc",
      }),
    ).toEqual({
      message_code: "invalid_field",
      params: { field: "email" },
      correlation_id: "req.123:abc",
    });
  });

  it.each([
    null,
    "Traceback",
    { message_code: "arbitrary", params: { text: "SELECT * FROM users" } },
    { message_code: "invalid_field", params: { field: "/etc/passwd" } },
  ])("rechaza payload no autorizado: %j", (payload) => {
    expect(parseUserMessage(payload)).toBeNull();
  });

  it("no interpola propiedades extra", () => {
    const parsed = parseUserMessage({
      message_code: "service_unavailable",
      params: { detail: "Bearer secret-token" },
    });
    expect(parsed).toEqual({ message_code: "service_unavailable" });
    expect(renderUserMessage(parsed!)).toBe(
      "No pudimos cargar la información. Intenta nuevamente.",
    );
  });
});
