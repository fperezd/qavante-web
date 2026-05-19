/* Preview LOCAL del addendum con flags ON + MSW (datos mock). NO es deploy.
 *
 * Por qué un launcher y no `.env.local`: `.env*` está gitignored (no se
 * puede commitear), y este script es cross-platform (Windows incluido) sin
 * agregar `cross-env`. Corre `next dev` (NODE_ENV=development) — clave: el
 * override `NEXT_PUBLIC_FF_*` SOLO se honra fuera de prod por diseño
 * (ADR-0008, invariante de feature-flags.ts). En un build de prod los flags
 * quedan OFF a propósito; por eso esto es local, no un preview desplegado.
 *
 * MSW browser dev (ADR-0005): `NEXT_PUBLIC_API_MOCKING=enabled` arranca el
 * service worker (msw-provider.tsx) y bypassa el login (auth/session.ts) →
 * se ven las pantallas cableadas con los fixtures de handlers.ts, sin
 * backend ni login real. */
import { spawn } from "node:child_process";

const env = {
  ...process.env,
  NEXT_PUBLIC_API_MOCKING: "enabled",
  // Same-origin para MSW (cookies); los handlers interceptan con wildcard.
  NEXT_PUBLIC_API_URL: "http://localhost:3000",
  // Flags del addendum ON (mapeo flagEnvVar de src/lib/feature-flags.ts).
  NEXT_PUBLIC_FF_MANAGEMENT_ACCOUNTS: "true",
  NEXT_PUBLIC_FF_MANAGEMENT_DIMENSIONS: "true",
  NEXT_PUBLIC_FF_MULTI_CURRENCY: "true",
  NEXT_PUBLIC_FF_CLASSIFICATION_RULES: "true",
  NEXT_PUBLIC_FF_BANK_MOVEMENT_CLASSIFICATION: "true",
  NEXT_PUBLIC_FF_INDUSTRY_TEMPLATES: "true",
  NEXT_PUBLIC_FF_PHASE2_PLANNING_PREVIEW: "true",
};

console.log(
  "\n▶ Preview addendum: flags ON + MSW (datos mock). Abrí http://localhost:3000\n" +
    "  Cableadas con datos reales (mock): /administracion/estructura-gestion, /administracion/vistas-gestion\n" +
    '  Aún "no disponible" (no construidas): monedas, reglas-clasificacion, caja/por-clasificar\n' +
    "  NO es deploy ni para merge — solo visualización local.\n",
);

const child = spawn("npx", ["next", "dev"], { env, stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
