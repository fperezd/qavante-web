import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const installer = join(repo, "scripts", "install-playwright-ci.sh");
const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";

function fakeCommand(dir, name, body) {
  const path = join(dir, name);
  writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`, { mode: 0o755 });
}

function runInstaller({ sudoExit = 0, npxExit = 0 } = {}) {
  const bin = mkdtempSync(join(tmpdir(), "qavante-playwright-ci-"));
  const log = join(bin, "calls.log");
  const shellLog = log.replaceAll("\\", "/");

  fakeCommand(bin, "sudo", `printf 'sudo:%s\\n' "$*" >> "${shellLog}"; exit ${sudoExit}`);
  fakeCommand(bin, "npx", `printf 'npx:%s\\n' "$*" >> "${shellLog}"; exit ${npxExit}`);

  const result = spawnSync(bash, [installer, "chromium", "chromium-headless-shell"], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin.replaceAll("\\", "/")}${delimiter}${process.env.PATH}`,
    },
  });

  return { result, calls: readFileSync(log, "utf8") };
}

test("retira sólo el repo apt de Chrome y conserva los navegadores pedidos", () => {
  const { result, calls } = runInstaller();

  assert.equal(result.status, 0);
  assert.match(
    calls,
    /^sudo:rm -f -- \/etc\/apt\/sources\.list\.d\/google-chrome\.list \/etc\/apt\/sources\.list\.d\/google-chrome\.list\.save$/m,
  );
  assert.match(calls, /^npx:playwright install --with-deps chromium chromium-headless-shell$/m);
});

test("un fallo al aislar apt detiene el job antes de Playwright", () => {
  const { result, calls } = runInstaller({ sudoExit: 41 });

  assert.equal(result.status, 41);
  assert.doesNotMatch(calls, /^npx:/m);
});

test("propaga sin ocultar el código de salida de Playwright", () => {
  const { result, calls } = runInstaller({ npxExit: 42 });

  assert.equal(result.status, 42);
  assert.match(calls, /^npx:playwright install --with-deps/m);
});

test("todos los consumidores usan el instalador común con su navegador", () => {
  const workflows = [
    ".github/workflows/ci.yml",
    ".github/workflows/deploy-cloudflare.yml",
    ".github/workflows/prod-canary.yml",
  ].map((relative) => readFileSync(join(repo, relative), "utf8"));
  const combined = workflows.join("\n");

  assert.equal(
    (combined.match(/bash scripts\/install-playwright-ci\.sh chromium$/gm) ?? []).length,
    3,
  );
  assert.equal(
    (
      combined.match(
        /bash scripts\/install-playwright-ci\.sh chromium chromium-headless-shell$/gm,
      ) ?? []
    ).length,
    1,
  );
  assert.doesNotMatch(combined, /npx playwright install .*--with-deps/);
});

test("el script mantiene sintaxis bash válida", () => {
  execFileSync(bash, ["-n", installer]);
});
