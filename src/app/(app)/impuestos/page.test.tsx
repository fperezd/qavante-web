import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { flagEnvVar, resolveFeatureFlag } from "@/lib/feature-flags";
import ImpuestosPage from "./page";

vi.mock("@/components/impuestos/v06/impuestos-v06-live", () => ({
  ImpuestosV06Live: ({ issueSucesor }: { issueSucesor?: string }) => (
    <section data-testid="impuestos-live">{issueSucesor}</section>
  ),
}));

afterEach(() => vi.unstubAllEnvs());

describe("V06: activación productiva y rollback", () => {
  it("el override versionado en vars habilita la ruta real sin exponer referencias internas", () => {
    const toml = readFileSync("wrangler.toml", "utf8");
    const vars = toml.split(/^\[vars\]\s*$/m)[1]?.split(/^\[/m)[0] ?? "";
    const value = vars.match(/^NEXT_PUBLIC_FF_IMPUESTOS_V06\s*=\s*"(true|false)"$/m)?.[1];
    expect(flagEnvVar("impuestosV06")).toBe("NEXT_PUBLIC_FF_IMPUESTOS_V06");
    expect(value).toBe("true");
    vi.stubEnv("NEXT_PUBLIC_FF_IMPUESTOS_V06", value);
    const html = renderToStaticMarkup(<ImpuestosPage />);
    expect(html).toContain('data-testid="impuestos-live"');
    expect(html).not.toContain("tooxs-digital/qavante-api#440");
    expect(html).not.toContain("Esta pantalla todavía no está disponible");
  });

  it.each([undefined, "false", "inválido"])("override %s conserva salida segura", (value) => {
    vi.stubEnv("NEXT_PUBLIC_FF_IMPUESTOS_V06", value);
    const html = renderToStaticMarkup(<ImpuestosPage />);
    expect(html).not.toContain('data-testid="impuestos-live"');
    expect(html).toContain("Esta pantalla todavía no está disponible");
    expect(html).toContain('href="/pagar/impuestos"');
    expect(html).toContain('href="/pagar/previred"');
  });

  it("kill-switch explícito prevalece incluso sobre configuración habilitada", () => {
    expect(
      resolveFeatureFlag("impuestosV06", {
        env: { NODE_ENV: "production", NEXT_PUBLIC_FF_IMPUESTOS_V06: "false" },
        config: { impuestosV06: true },
      }),
    ).toBe(false);
  });
});
