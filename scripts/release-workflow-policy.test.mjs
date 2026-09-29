import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const workflows = join(repo, ".github", "workflows");
function activeOperationDocs(directory, relative = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = join(directory, entry.name);
    const childRelative = join(relative, entry.name);
    if (entry.isDirectory()) {
      return /^(archive|history|historical)$/i.test(entry.name)
        ? []
        : activeOperationDocs(child, childRelative);
    }
    return entry.isFile() && /\.md$/i.test(entry.name) ? [childRelative] : [];
  });
}

const activeReleaseDocs = [
  "README.md",
  "docs/ARCHITECTURE.md",
  ...activeOperationDocs(join(repo, "docs", "operations")).map((relative) =>
    join("docs", "operations", relative),
  ),
];

const operationalBypassMarkers = [
  { expression: /deploy-cloudflare\.yml/i, variants: ["deploy-cloudflare.yml"] },
  { expression: /\bgh\s+workflow\s+run\b/i, variants: ["gh workflow run deploy.yml"] },
  {
    expression: /\b(?:npx\s+)?wrangler\s+(?:deploy|rollback|login)\b/i,
    variants: ["npx wrangler deploy", "wrangler rollback", "wrangler login"],
  },
  {
    expression: /cloudflare\s+dashboard|dashboard\s+(?:de\s+)?cloudflare/i,
    variants: ["Cloudflare Dashboard", "dashboard de Cloudflare"],
  },
  { expression: /save and deploy/i, variants: ["Save and deploy"] },
];

const deploymentMarkers = [
  {
    name: "Azure actions",
    expression: /azure\/(?:login|cli)@/i,
    variants: ["uses: azure/login@v2", "uses: azure/cli@v2"],
  },
  {
    name: "ACR login o referencia",
    expression: /(?:\baz\s+acr\s+login\b|azurecr\.io|docker\/login-action@)/i,
    variants: [
      "az acr login --name acrqavanteprod",
      "acrqavanteprod.azurecr.io/qavante-web:prod",
      "uses: docker/login-action@v3",
    ],
  },
  {
    name: "push de imagen",
    expression: /\b(?:docker|nerdctl|podman)\s+push\b/i,
    variants: ["docker push registry/image:tag", "podman push registry/image:tag"],
  },
  {
    name: "despliegue de recursos Azure",
    expression: /\baz\s+(?:containerapp|webapp|functionapp)\b/i,
    variants: [
      "az containerapp update -n qavante-web",
      "az webapp deploy --name qavante-web",
      "az functionapp deployment source config-zip",
    ],
  },
  {
    name: "build y push combinado",
    expression: /(?:\bdocker\s+buildx\s+build\b[\s\S]{0,1000}--push\b|docker\/build-push-action@)/i,
    variants: [
      "docker buildx build --push -t registry/image:tag .",
      "docker buildx build --tag registry/image:tag --push .",
      "uses: docker/build-push-action@v6",
    ],
  },
  {
    name: "despliegue Wrangler",
    expression: /(?:\b(?:npx\s+)?wrangler\s+deploy\b|cloudflare\/wrangler-action@)/i,
    variants: ["npx wrangler deploy", "uses: cloudflare/wrangler-action@v3"],
  },
];

test("sólo Deploy web to Azure PROD puede desplegar desde GitHub Actions", () => {
  const names = readdirSync(workflows).filter((name) => /\.ya?ml$/i.test(name));
  const prodWorkflow = "deploy-azure-prod.yml";
  assert.ok(names.includes(prodWorkflow), "debe existir el workflow Azure PROD recuperado");
  const removed = ["deploy-azure-qas.yml", "deploy-cloudflare.yml", "prod-canary.yml"];

  for (const name of removed) assert.ok(!names.includes(name), `${name} debe permanecer retirado`);

  const automation = names
    .filter((name) => name !== prodWorkflow)
    .map((name) => readFileSync(join(workflows, name), "utf8"))
    .join("\n");

  for (const marker of deploymentMarkers) {
    assert.doesNotMatch(automation, marker.expression, `${marker.name} no puede vivir en Actions`);
    for (const variant of marker.variants) assert.match(variant, marker.expression);
  }

  const prod = readFileSync(join(workflows, prodWorkflow), "utf8");
  assert.match(prod, /^name: Deploy web to Azure PROD$/m);
  assert.match(prod, /^  push:$/m);
  assert.match(prod, /^      - main$/m);
  assert.match(prod, /^  workflow_dispatch:$/m);
  assert.match(prod, /id-token: write/);
  assert.match(prod, /uses: azure\/login@v2/);
  assert.match(prod, /APP: ca-qavante-web-prod/);
  assert.match(prod, /NEXT_PUBLIC_API_URL: https:\/\/api\.qavante\.com/);
  assert.doesNotMatch(prod, /wrangler\s+deploy|cloudflare\/wrangler-action@/i);
});

test("la ruta local heredada permanece desactivada por defecto", () => {
  const release = readFileSync(join(repo, "scripts", "local_azure_release.mjs"), "utf8");

  assert.match(release, /QAVANTE_ENABLE_LEGACY_LOCAL_RELEASE !== "1"/);
  assert.match(release, /run\("docker", \[/);
  assert.match(release, /\["containerapp", "update"/);
  assert.match(release, /@sha256:\[0-9a-f\]\{64\}/);
});

test("la documentacion operativa no ofrece bypass de despliegue", () => {
  const operationalText = activeReleaseDocs
    .map((relative) => readFileSync(join(repo, relative), "utf8"))
    .join("\n");

  for (const marker of operationalBypassMarkers) {
    assert.doesNotMatch(operationalText, marker.expression);
    for (const variant of marker.variants) assert.match(variant, marker.expression);
  }
});
