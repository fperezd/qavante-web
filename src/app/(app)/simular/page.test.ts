import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Simular: runtime Cloudflare", () => {
  it("usa el runtime por defecto de OpenNext", () => {
    const source = readFileSync("src/app/(app)/simular/page.tsx", "utf8");

    expect(source).not.toMatch(/export\s+const\s+runtime\s*=\s*["']edge["']/);
  });
});
