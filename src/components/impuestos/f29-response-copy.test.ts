import { describe, expect, it } from "vitest";
import { f29ResponseMessage } from "./f29-response-copy";

describe("f29ResponseMessage", () => {
  it("entrega mensajes de negocio estables para los estados sin resultado", () => {
    expect(f29ResponseMessage("not_found")).toContain("no corresponde a una declaración");
    expect(f29ResponseMessage("error")).toContain("problema al consultar");
  });

  it("no necesita ni presenta el mensaje libre recibido del proveedor", () => {
    const raw = "TimeoutError at /srv/sii/f29.py:87 API_KEY=secret";
    const visible = f29ResponseMessage("error");

    expect(visible).not.toContain(raw);
    expect(visible).not.toMatch(/TimeoutError|\/srv\/|\.py|API_KEY/i);
  });
});
