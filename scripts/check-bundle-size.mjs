#!/usr/bin/env node
/* Check First Load JS por route contra presupuestos del Kit Sprint C0 DoD.
   Lee .next/app-build-manifest.json (generado por `next build`), suma el gzip
   de los chunks JS de cada route en BUDGETS, falla si excede.

   Por qué propio y no `size-limit`: los chunks de Next.js son hashed, el
   manifest tiene el mapeo route→chunks robusto, y queremos un check
   exactamente alineado al concepto "First Load JS" del DoD. */
import { readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const MANIFEST_PATH = ".next/app-build-manifest.json";
const STATIC_DIR = ".next";

/** Presupuestos por route, en KB (gzip). Alineados con Kit Sprint C0 DoD sec 5.2:
 *  - /login < 200KB gzip (hard requirement, DoD del Kit).
 *  - /app/inicio: presupuesto generoso por ahora; Lighthouse es el gate final
 *    en CI (job `lighthouse` desde PR #49).
 *  - /app/administracion/usuarios: admin-only (sólo owner/admin/technical_admin
 *    ven el módulo según sidebar gate de PR #48), tolera más peso que rutas
 *    user-facing. Budget 250 KB cubre el costo actual (~195 KB gzip, dominado
 *    por TanStack Table + react-hook-form + zod) con ~25% headroom para
 *    columnas / filtros adicionales sin reventar CI. Si excede en el futuro,
 *    candidatos para dynamic(): InviteUserDialog (sólo abre on-demand),
 *    SuspendUserDialog (idem). Polish del audit Anexo K.4 hallazgo menor #2.
 *  Keys son rutas como aparecen en el app-build-manifest.json (con grupos
 *  Next.js entre paréntesis y sufijo /page). */
const BUDGETS_KB = {
  "/(auth)/login/page": 200,
  "/(app)/inicio/page": 400,
  "/(app)/administracion/usuarios/page": 250,
  "/(app)/administracion/credenciales/page": 250,
};

function gzipSizeKB(filePath) {
  const buf = readFileSync(filePath);
  return gzipSync(buf, { level: 9 }).length / 1024;
}

function checkBudgets() {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
  } catch (err) {
    console.error(`✘ No pude leer ${MANIFEST_PATH}. ¿Corriste \`npm run build\` antes?`);
    console.error(`  ${err.message}`);
    process.exit(2);
  }

  const results = [];
  let anyFail = false;

  for (const [route, budgetKB] of Object.entries(BUDGETS_KB)) {
    const chunks = manifest.pages?.[route];
    if (!chunks) {
      console.error(`✘ Route "${route}" no aparece en el manifest. Routes disponibles:`);
      Object.keys(manifest.pages)
        .sort()
        .forEach((r) => console.error(`    ${r}`));
      process.exit(2);
    }

    let totalKB = 0;
    const jsChunks = chunks.filter((c) => c.endsWith(".js"));
    for (const chunk of jsChunks) {
      const filePath = join(STATIC_DIR, chunk);
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
