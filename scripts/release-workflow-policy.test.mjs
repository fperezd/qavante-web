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
  { expression: /\bworkflow_dispatch\b/i, variants: ["workflow_dispatch"] },
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

test("GitHub Actions no contiene rutas de despliegue", () => {
  const names = readdirSync(workflows).filter((name) => /\.ya?ml$/i.test(name));
  const removed = [
    "deploy-azure-prod.yml",
    "deploy-azure-qas.yml",
    "deploy-cloudflare.yml",
    "prod-canary.yml",
  ];

  for (const name of removed) assert.ok(!names.includes(name), `${name} debe permanecer retirado`);

  const automation = names
    .map((name) => readFileSync(join(workflows, name), "utf8"))
    .join("\n");

  for (const marker of deploymentMarkers) {
    assert.doesNotMatch(automation, marker.expression, `${marker.name} no puede vivir en Actions`);
    for (const variant of marker.variants) assert.match(variant, marker.expression);
  }
});

test("la promociÃ³n Azure permanece en la ruta local con digest inmutable", () => {
  const release = readFileSync(join(repo, "scripts", "local_azure_release.mjs"), "utf8");

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
