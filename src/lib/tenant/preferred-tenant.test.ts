import { describe, it, expect } from "vitest";
import { pickPreferredTenant } from "./preferred-tenant";

const t = (id: string) => ({ id });

describe("pickPreferredTenant", () => {
  it("vuelve a la preferida (predeterminada o última usada) si el usuario aún pertenece", () => {
    const items = [t("tooxs"), t("otra")];
    // El switcher pasa `defaultId ?? lastUsed`: con una empresa predeterminada
    // elegida ("otra"), esa gana sobre la primera de la lista.
    expect(pickPreferredTenant(items, "otra")?.id).toBe("otra");
  });

  it("si la preferida ya no está (o no hay ninguna), cae en la primera", () => {
    const items = [t("tooxs"), t("otra")];
    expect(pickPreferredTenant(items, "vieja-inexistente")?.id).toBe("tooxs");
    expect(pickPreferredTenant(items, null)?.id).toBe("tooxs");
  });

  it("lista vacía → null", () => {
    expect(pickPreferredTenant([], "x")).toBeNull();
  });
});
