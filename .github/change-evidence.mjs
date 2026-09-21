const MATERIAL_SECTIONS = Object.freeze([
  /^(?:##|#)\s+(?:risk|riesgo)\s*$/im,
  /^(?:##|#)\s+(?:evidence|evidencia)\s*$/im,
  /^(?:##|#)\s+rollback\s*$/im,
]);

const HIGH_RISK = Object.freeze([
  /^src\/.*(?:auth|session|credential|money|financial|cash|caja|cobrar|pagar|decision|forecast|p&l)/i,
  /^src\/middleware\.ts$/i,
  /^docs\/contracts\//i,
  /^\.github\/(?:workflows\/|change-evidence|release)/i,
  /^wrangler\.toml$/i,
]);

const DOC_ONLY = /^(?:docs\/|[^/]+\.md$)/i;

export function evaluateChangeEvidence({ labels = [], files = [], body = "", draft = false }) {
  if (draft) return { risk: "draft", material: false, protectedPaths: [] };

  const risks = labels.filter((label) => /^risk:R[012]$/.test(label));
  if (risks.length > 1) throw new Error("El PR tiene más de un label de riesgo.");
  const protectedPaths = files.filter((file) => HIGH_RISK.some((pattern) => pattern.test(file)));
  const risk = risks[0] ?? "risk:R0";

  if (protectedPaths.length && risk !== "risk:R2") {
    throw new Error(`Paths protegidos requieren risk:R2: ${protectedPaths.slice(0, 8).join(", ")}`);
  }

  const material = files.some((file) => !DOC_ONLY.test(file));
  if (material) {
    const missing = MATERIAL_SECTIONS.filter((pattern) => !pattern.test(body)).map(
      (pattern, index) => ["Risk/Riesgo", "Evidence/Evidencia", "Rollback"][index],
    );
    if (missing.length) throw new Error(`Faltan secciones mecánicas: ${missing.join(", ")}.`);
  }

  return { risk, material, protectedPaths };
}
