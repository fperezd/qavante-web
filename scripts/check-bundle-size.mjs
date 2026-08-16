#!/usr/bin/env node
/* Check First Load JS por route contra presupuestos del Kit Sprint C0 DoD.
   Lee el manifest generado por `next build` (único en Next 15 o por route en
   Next 16/Turbopack), suma el gzip
   de los chunks JS de cada route en BUDGETS, falla si excede.

   Por qué propio y no `size-limit`: los chunks de Next.js son hashed, el
   manifest tiene el mapeo route→chunks robusto, y queremos un check
   exactamente alineado al concepto "First Load JS" del DoD. */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const LEGACY_MANIFEST_PATH = ".next/app-build-manifest.json";
const SERVER_APP_DIR = ".next/server/app";
const STATIC_DIR = ".next";

/** Presupuestos por route, en KB (gzip). Alineados con Kit Sprint C0 DoD sec 5.2:
 *  - /login < 200KB gzip (hard requirement, DoD del Kit).
 *  - /aceptar-invitacion < 200KB — route PÚBLICA (link por email), user
 *    primer-toque a Qavante; misma prioridad de bundle que /login.
 *  - /app/inicio: presupuesto generoso por ahora; Lighthouse es el gate final
 *    en CI (job `lighthouse` desde PR #49).
 *  - /app/administracion/usuarios: admin-only (sólo owner/admin/technical_admin
 *    ven el módulo según sidebar gate de PR #48), tolera más peso que rutas
 *    user-facing. Budget 250 KB. Dynamic imports en dialogs (PR #61) bajaron
 *    el First Load de 194 → 146 KB.
 *  - /app/administracion/credenciales: idem admin-only, budget 250 KB.
 *  Keys son rutas como aparecen en los manifests de Next (con grupos
 *  Next.js entre paréntesis y sufijo /page). */
const BUDGETS_KB = {
  "/(auth)/login/page": 200,
  "/(auth)/aceptar-invitacion/page": 200,
  "/(app)/inicio/page": 400,
  "/(app)/administracion/usuarios/page": 250,
  "/(app)/administracion/credenciales/page": 250,
};

function gzipSizeKB(filePath) {
  const buf = readFileSync(filePath);
  return gzipSync(buf, { level: 9 }).length / 1024;
}

function readManifest(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function chunksFromClientReferenceManifest(route) {
  // Turbopack puede conservar o eliminar los grupos de rutas en las carpetas
  // internas; la clave del manifest es la referencia estable que usamos.
  const publicRoute = route.replace(/\/\([^/]+\)/g, "");
  const candidates = [route, publicRoute];
  const files = readdirSync(SERVER_APP_DIR, { recursive: true })
    .filter((entry) => entry.endsWith("page_client-reference-manifest.js"))
    .map((entry) => join(SERVER_APP_DIR, entry));

  for (const manifestPath of files) {
    const source = readFileSync(manifestPath, "utf-8");
    if (!candidates.some((candidate) => source.includes(`__RSC_MANIFEST["${candidate}"]`))) {
      continue;
    }

    const assignmentStart = source.indexOf("__RSC_MANIFEST[");
    const jsonStart = source.indexOf("=", assignmentStart);
    const jsonEnd = source.lastIndexOf(";");
    if (assignmentStart < 0 || jsonStart < 0 || jsonEnd < 0) {
      console.error(`✘ Formato inesperado en ${manifestPath}.`);
      process.exit(2);
    }

    const manifest = JSON.parse(source.slice(jsonStart + 1, jsonEnd));
    return [
      ...new Set(
        Object.values(manifest.clientModules ?? {}).flatMap((module) => module.chunks ?? []),
      ),
    ];
  }

  return null;
}

function chunksForRoute(route) {
  // Next 15 escribía un manifest único; Next 16/Turbopack publica referencias
  // de cliente por ruta dentro de .next/server/app.
  if (existsSync(LEGACY_MANIFEST_PATH)) {
    const chunks = readManifest(LEGACY_MANIFEST_PATH).pages?.[route];
    if (chunks) return chunks;
  }

  const chunks = chunksFromClientReferenceManifest(route);
  if (chunks?.length) return chunks;

  console.error(`✘ No encontré chunks de cliente para "${route}". Rutas buscadas:`);
  console.error(`    ${LEGACY_MANIFEST_PATH}`);
  console.error(`    ${join(SERVER_APP_DIR, "<ruta>", "page_client-reference-manifest.js")}`);
  process.exit(2);
}

function checkBudgets() {
  const results = [];
  let anyFail = false;

  for (const [route, budgetKB] of Object.entries(BUDGETS_KB)) {
    const chunks = chunksForRoute(route);

    let totalKB = 0;
    const jsChunks = chunks.filter((c) => c.endsWith(".js"));
    for (const chunk of jsChunks) {
      const filePath = join(STATIC_DIR, chunk.replace(/^\/_next\//, ""));
      try {
        statSync(filePath);
      } catch {
        console.error(`✘ Chunk no encontrado en filesystem: ${filePath}`);
        process.exit(2);
      }
      totalKB += gzipSizeKB(filePath);
    }

    const pass = totalKB <= budgetKB;
    if (!pass) anyFail = true;
    results.push({ route, totalKB, budgetKB, pass, chunks: jsChunks.length });
  }

  console.log("Bundle size — First Load JS (gzip) por route");
  console.log("─".repeat(72));
  for (const r of results) {
    const icon = r.pass ? "✓" : "✘";
    const pct = ((r.totalKB / r.budgetKB) * 100).toFixed(1);
    console.log(
      `  ${icon} ${r.route.padEnd(34)} ${r.totalKB.toFixed(1).padStart(6)} KB / ${r.budgetKB} KB (${pct}%, ${r.chunks} chunks)`,
    );
  }
  console.log("─".repeat(72));

  if (anyFail) {
    console.error("\n✘ Bundle size excede presupuesto del Kit Sprint C0 DoD.");
    console.error("  Revisar imports de la route afectada. Tips:");
    console.error("  - dynamic() import para libs pesadas no críticas en first render");
    console.error("  - tree-shaking: importar named exports, no default barrel");
    console.error("  - revisar bundle con `npx @next/bundle-analyzer` (opcional)");
    process.exit(1);
  }

  console.log("\n✓ Todas las routes dentro del presupuesto.");
}

checkBudgets();
