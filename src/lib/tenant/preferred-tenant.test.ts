import { describe, it, expect } from "vitest";
import { pickPreferredTenant } from "./preferred-tenant";

const t = (id: string) => ({ id });

describe("pickPreferredTenant", () => {
  it("vuelve a la última usada si el usuario aún pertenece a ella", () => {
    const items = [t("tooxs"), t("otra")];
    expect(pickPreferredTenant(items, "otra")?.id).toBe("otra");
  });

  it("si la última ya no está (o no hay), cae en la primera", () => {
    const items = [t("tooxs"), t("otra")];
    expect(pickPreferredTenant(items, "vieja-inexistente")?.id).toBe("tooxs");
    expect(pickPreferredTenant(items, null)?.id).toBe("tooxs");
  });

  it("lista vacía → null", () => {
    expect(pickPreferredTenant([], "x")).toBeNull();
  });
});
