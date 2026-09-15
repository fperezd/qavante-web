import { describe, expect, it } from "vitest";
import { resolvePagarVariant } from "./pagar-route";

describe("resolvePagarVariant", () => {
  it.each([
    [{ pagarV05: true, pagarV2: true, accountsPayable: true }, "v05"],
    [{ pagarV05: true, pagarV2: false, accountsPayable: true }, "v05"],
    [{ pagarV05: false, pagarV2: true, accountsPayable: true }, "v2"],
    [{ pagarV05: false, pagarV2: false, accountsPayable: true }, "classic"],
    [{ pagarV05: false, pagarV2: true, accountsPayable: false }, "none"],
    [{ pagarV05: false, pagarV2: false, accountsPayable: false }, "none"],
  ] as const)("resuelve %o como %s", (flags, expected) => {
    expect(resolvePagarVariant(flags)).toBe(expected);
  });
});
