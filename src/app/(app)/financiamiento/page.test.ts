import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Financiamiento: runtime Cloudflare", () => {
  it("usa el runtime por defecto de OpenNext", () => {
    const source = readFileSync("src/app/(app)/financiamiento/page.tsx", "utf8");

    expect(source).not.toMatch(/export\s+const\s+runtime\s*=\s*["']edge["']/);
  });
});
