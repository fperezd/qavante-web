import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SOURCE_ROOT = path.resolve("src");
const UI_ROOTS = [path.join(SOURCE_ROOT, "app"), path.join(SOURCE_ROOT, "components")];
const SOURCE = /\.(?:ts|tsx)$/;
const EXCLUDED = /\.(?:test|spec)\.(?:ts|tsx)$/;

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(entryPath);
    return SOURCE.test(entry.name) && !EXCLUDED.test(entry.name) ? [entryPath] : [];
  });
}

/**
 * Devuelve offsets fuera de comentarios. Así el guard revisa copy que puede
 * renderizarse, sin convertir comentarios técnicos en falsos positivos.
 */
export function emDashesOutsideComments(source) {
  const sourceFile = ts.createSourceFile(
    "copy.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const matches = [];
  const inspect = (node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isJsxText(node)
    ) {
      const text = node.getText(sourceFile);
      const start = node.getStart(sourceFile);
      for (let index = text.indexOf("—"); index !== -1; index = text.indexOf("—", index + 1)) {
        matches.push(start + index);
      }
    }
    ts.forEachChild(node, inspect);
  };
  inspect(sourceFile);
  return matches;
}

export function visibleCopyWithEmDash() {
  return UI_ROOTS.flatMap((fileRoot) =>
    walk(fileRoot).flatMap((file) => {
      const source = fs.readFileSync(file, "utf8");
      return emDashesOutsideComments(source).map((offset) => ({
        file: path.relative(process.cwd(), file),
        offset,
      }));
    }),
  );
}

export function replaceEmDashesOutsideComments(source) {
  const offsets = emDashesOutsideComments(source);
  return offsets.reduceRight(
    (result, offset) => `${result.slice(0, offset)}·${result.slice(offset + 1)}`,
    source,
  );
}

export function replaceVisibleCopyEmDashes() {
  for (const fileRoot of UI_ROOTS) {
    for (const file of walk(fileRoot)) {
      const source = fs.readFileSync(file, "utf8");
      const next = replaceEmDashesOutsideComments(source);
      if (next !== source) fs.writeFileSync(file, next);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--fix")) replaceVisibleCopyEmDashes();
  const matches = visibleCopyWithEmDash();
  if (matches.length > 0) {
    console.error(matches.map(({ file }) => file).join("\n"));
    process.exitCode = 1;
  }
}
