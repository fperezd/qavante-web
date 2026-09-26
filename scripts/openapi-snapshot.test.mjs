import { describe, expect, it } from "vitest";
import { buildSource, sha256, verifySource } from "./openapi-snapshot.mjs";

const snapshot = Buffer.from('{"openapi":"3.1.0","paths":{}}\n');
const source = buildSource({
  repo: "tooxs-digital/qavante-api",
  ref: "main",
  sha: "c3c3a9f4b6a7afc4db98b28939984fb181fd055f",
  path: "docs/contracts/openapi.snapshot.json",
  snapshot,
  fetchedAt: "2026-09-16T03:02:00.000Z",
});

describe("openapi-snapshot: sidecar de origen", () => {
  it("una copia íntegra y trazable no tiene problemas", () => {
    expect(source.sha256).toBe(sha256(snapshot));
    expect(verifySource(source, snapshot)).toEqual([]);
  });

  it("conserva el digest de bytes, incluyendo CRLF del productor", () => {
    const withCrlf = Buffer.from('{"openapi":"3.1.0"}\r\n');
    const crlfSource = buildSource({
      repo: "tooxs-digital/qavante-api",
      ref: "main",
      sha: "c3c3a9f4b6a7afc4db98b28939984fb181fd055f",
      path: "docs/contracts/openapi.snapshot.json",
      snapshot: withCrlf,
      fetchedAt: "2026-09-16T03:02:00.000Z",
    });
    expect(verifySource(crlfSource, withCrlf)).toEqual([]);
    expect(verifySource(crlfSource, Buffer.from('{"openapi":"3.1.0"}\n'))).toHaveLength(1);
  });

  it("un snapshot editado sin pasar por sync falla por sha256", () => {
    const problems = verifySource(source, Buffer.from('{"openapi":"3.1.0","paths":{"/x":{}}}\n'));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/no coincide con el sha256/);
    expect(problems[0]).toMatch(/generate:api:sync/);
  });

  it("exige SHA de commit completo, sha256 y fecha ISO", () => {
    expect(verifySource({ ...source, sha: "c3c3a9f" }, snapshot)).toEqual([
      expect.stringMatching(/"sha" no es un SHA de commit completo/),
    ]);
    expect(verifySource({ ...source, sha256: "abc" }, snapshot)).toEqual([
      expect.stringMatching(/"sha256" no es un digest/),
    ]);
    expect(verifySource({ ...source, fetched_at: "ayer" }, snapshot)).toEqual([
      expect.stringMatching(/"fetched_at" no es una fecha ISO 8601/),
    ]);
  });

  it("reporta cada campo obligatorio ausente y rechaza lo que no es un objeto", () => {
    const { sha, fetched_at: _omit, ...partial } = source;
    void sha;
    void _omit;
    expect(verifySource(partial, snapshot)).toEqual([
      expect.stringMatching(/falta "sha"/),
      expect.stringMatching(/falta "fetched_at"/),
    ]);
    expect(verifySource([], snapshot)).toEqual([expect.stringMatching(/debe ser un objeto JSON/)]);
    expect(verifySource(null, snapshot)).toEqual([
      expect.stringMatching(/debe ser un objeto JSON/),
    ]);
  });
});
