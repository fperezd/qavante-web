#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SOURCE_ROOTS = [path.resolve("src/app"), path.resolve("src/components")];
const SOURCE_FILE = /\.(?:ts|tsx)$/;
const EXCLUDED_FILE = /(?:\.test|\.spec|\.stories)\.(?:ts|tsx)$/;

/** Boundaries fuera de D16-A, con la razón explícita exigida por la auditoría. */
export const FILE_ALLOWLIST = new Map([
  [
    "src/components/gestion/v2/contraparte-360-view.tsx",
    "D06 Cliente 360 está fuera del boundary D16-A.",
  ],
  ["src/components/caja/", "Caja y cash-projection están fuera del boundary D16-A."],
]);

const UI_PROPERTY_NAMES = new Set([
  "aria-label",
  "alt",
  "cause",
  "definicion",
  "description",
  "detail",
  "excluye",
  "hint",
  "incluye",
  "label",
  "message",
  "motivo",
  "placeholder",
  "reason",
  "subtitle",
  "title",
  "texto",
]);
const UI_NAME_SUFFIX = /(?:msg|message|mensaje|detail|reason)$/i;

/** Campos de transporte que jamás deben cruzar a las superficies corregidas por D16-A. */
export const RAW_ACCESS_RULES = new Map([
  ["src/components/conexiones/conexiones-view.tsx", new Set(["source.reason"])],
  ["src/components/cobrar/v04/cobrar-v04-view.tsx", new Set(["item.detail"])],
  ["src/components/bandeja/v07/bandeja-v07-model.ts", new Set(["resp.detail.explicacion"])],
  ["src/components/inicio/v01/activity-log-view.tsx", new Set(["result.detail.explicacion"])],
  ["src/components/inicio/v01/operation-plan-model.ts", new Set(["error.reason"])],
  ["src/components/inicio/v01/cash-gap-proposal-panel.tsx", new Set(["target.reason"])],
  ["src/components/impuestos/f29-view.tsx", new Set(["data.message"])],
  ["src/components/shell/sync-status-indicator.tsx", new Set(["s.reason"])],
]);

export const FORBIDDEN_COPY = [
  { name: "referencia a piloto", pattern: /\bpiloto\b/i },
  { name: "referencia a sucesor", pattern: /\bsucesor\b/i },
  { name: "ley interna numerada", pattern: /\bley\s*\d+\b/i },
  { name: "referencia técnica", pattern: /\b(?:backend|frontend|endpoint|issue|ticket|spec)\b/i },
  { name: "identificador interno", pattern: /(?:^|\s)#\d+\b/ },
  {
    name: "ETA estática",
    pattern: /(?:~\s*\d+\s*s\b|\b(?:unos?|menos de)\s+\d+\s+segundos?\b)/i,
  },
  { name: "nota de implementación", pattern: /\b(?:no implementad[oa]|en preparación)\b/i },
];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(entryPath);
    return SOURCE_FILE.test(entry.name) && !EXCLUDED_FILE.test(entry.name) ? [entryPath] : [];
  });
}

function literalText(node) {
  if (ts.isJsxText(node) || ts.isStringLiteralLike(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(" ");
  }
  return null;
}

function propertyName(node) {
  if (!node) return null;
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
  return null;
}

function isUiName(name) {
  return UI_PROPERTY_NAMES.has(name) || UI_NAME_SUFFIX.test(name);
}

function isDisplayCall(node) {
  if (!ts.isCallExpression(node)) return false;
  const expression = node.expression;
  if (ts.isIdentifier(expression))
    return /^(?:set.*(?:Error|Aviso|Message)|alert)$/i.test(expression.text);
  if (!ts.isPropertyAccessExpression(expression)) return false;
  return /^(?:error|info|message|success|warning)$/i.test(expression.name.text);
}

function functionLikeName(node) {
  if (ts.isFunctionDeclaration(node) && node.name) return node.name.text;
  if (ts.isFunctionExpression(node) && node.name) return node.name.text;
  if (
    (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) &&
    ts.isVariableDeclaration(node.parent)
  ) {
    return propertyName(node.parent.name);
  }
  if (
    (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) &&
    ts.isPropertyAssignment(node.parent)
  ) {
    return propertyName(node.parent.name);
  }
  return null;
}

function isFunctionLike(node) {
  return (
    ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)
  );
}

function isVisibleLiteral(node) {
  const parent = node.parent;
  if (ts.isJsxText(node) || ts.isJsxAttribute(parent)) return true;
  if (ts.isJsxExpression(parent)) return true;
  if (ts.isPropertyAssignment(parent)) return isUiName(propertyName(parent.name) ?? "");
  if (ts.isCallExpression(parent)) return isDisplayCall(parent);
  if (
    ts.isArrayLiteralExpression(parent) ||
    (ts.isBinaryExpression(parent) &&
      (parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
        parent.operatorToken.kind === ts.SyntaxKind.BarBarToken)) ||
    ts.isConditionalExpression(parent) ||
    ts.isParenthesizedExpression(parent)
  ) {
    return Boolean(parent.parent && isVisibleLiteral(parent));
  }
  if (ts.isVariableDeclaration(parent)) {
    return isUiName(propertyName(parent.name) ?? "");
  }
  if (ts.isArrowFunction(parent) || ts.isFunctionExpression(parent)) {
    return isUiName(functionLikeName(parent) ?? "");
  }
  if (ts.isReturnStatement(parent)) {
    let current = parent.parent;
    while (current && !isFunctionLike(current)) current = current.parent;
    return Boolean(current && isUiName(functionLikeName(current) ?? ""));
  }
  return false;
}

function resolveAliasPath(value, aliases, seen = new Set()) {
  if (seen.has(value)) return value;
  seen.add(value);
  if (aliases.has(value)) return resolveAliasPath(aliases.get(value), aliases, seen);

  const parts = value.split(".");
  for (let length = parts.length - 1; length > 0; length -= 1) {
    const prefix = parts.slice(0, length).join(".");
    if (aliases.has(prefix) && !seen.has(prefix)) {
      const resolved = resolveAliasPath(aliases.get(prefix), aliases, seen);
      return resolveAliasPath([resolved, ...parts.slice(length)].join("."), aliases, seen);
    }
  }
  return value;
}

function lexicalAccessPath(node) {
  if (ts.isParenthesizedExpression(node)) return lexicalAccessPath(node.expression);
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) {
    const base = lexicalAccessPath(node.expression);
    return base ? `${base}.${node.name.text}` : null;
  }
  if (ts.isElementAccessExpression(node) && node.argumentExpression) {
    const base = lexicalAccessPath(node.expression);
    const key = propertyName(node.argumentExpression);
    return base && key ? `${base}.${key}` : null;
  }
  return null;
}

function accessPath(node, aliases = new Map()) {
  const lexical = lexicalAccessPath(node);
  return lexical ? resolveAliasPath(lexical, aliases) : null;
}

function bindPattern(pattern, sourcePath, aliases) {
  if (ts.isParenthesizedExpression(pattern)) {
    bindPattern(pattern.expression, sourcePath, aliases);
    return;
  }
  if (ts.isIdentifier(pattern)) {
    aliases.set(pattern.text, sourcePath);
    return;
  }
  if (!ts.isObjectBindingPattern(pattern) && !ts.isObjectLiteralExpression(pattern)) return;
  for (const element of pattern.elements ?? pattern.properties) {
    if (ts.isBindingElement(element) && !element.dotDotDotToken && ts.isIdentifier(element.name)) {
      const key = propertyName(element.propertyName ?? element.name);
      if (key) aliases.set(element.name.text, `${sourcePath}.${key}`);
    } else if (ts.isShorthandPropertyAssignment(element)) {
      aliases.set(element.name.text, `${sourcePath}.${element.name.text}`);
    } else if (ts.isPropertyAssignment(element) && ts.isIdentifier(element.initializer)) {
      const key = propertyName(element.name);
      if (key) aliases.set(element.initializer.text, `${sourcePath}.${key}`);
    }
  }
}

function clearAliasTree(targetPath, aliases) {
  for (const key of aliases.keys()) {
    if (key === targetPath || key.startsWith(`${targetPath}.`)) aliases.delete(key);
  }
}

function overwriteAlias(targetPath, sourcePath, aliases) {
  clearAliasTree(targetPath, aliases);
  aliases.set(targetPath, sourcePath ?? `safe.${targetPath}`);
}

function applyObjectMembers(targetPath, object, aliases) {
  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property)) {
      if (ts.isObjectLiteralExpression(property.expression)) {
        applyObjectMembers(targetPath, property.expression, aliases);
      } else {
        overwriteAlias(targetPath, accessPath(property.expression, aliases), aliases);
      }
      continue;
    }

    const key = propertyName(property.name);
    if (!key) continue;
    const propertyPath = `${targetPath}.${key}`;
    if (ts.isPropertyAssignment(property)) {
      if (ts.isObjectLiteralExpression(property.initializer)) {
        clearAliasTree(propertyPath, aliases);
        applyObjectMembers(propertyPath, property.initializer, aliases);
      } else {
        overwriteAlias(propertyPath, accessPath(property.initializer, aliases), aliases);
      }
    } else if (ts.isShorthandPropertyAssignment(property)) {
      overwriteAlias(propertyPath, accessPath(property.name, aliases), aliases);
    } else {
      overwriteAlias(propertyPath, null, aliases);
    }
  }
}

function materializeExpression(node, targetPath, aliases) {
  if (ts.isObjectLiteralExpression(node)) {
    clearAliasTree(targetPath, aliases);
    applyObjectMembers(targetPath, node, aliases);
    return targetPath;
  }
  return accessPath(node, aliases);
}

function jsxAttributeValue(attribute, aliases) {
  if (!attribute.initializer) return null;
  if (ts.isStringLiteral(attribute.initializer)) return null;
  if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) {
    return accessPath(attribute.initializer.expression, aliases);
  }
  return null;
}

function materializeJsxProps(node, targetPath, aliases) {
  clearAliasTree(targetPath, aliases);
  for (const attribute of node.attributes.properties) {
    if (ts.isJsxSpreadAttribute(attribute)) {
      if (ts.isObjectLiteralExpression(attribute.expression)) {
        applyObjectMembers(targetPath, attribute.expression, aliases);
      } else {
        overwriteAlias(targetPath, accessPath(attribute.expression, aliases), aliases);
      }
      continue;
    }
    const key = propertyName(attribute.name);
    if (key) overwriteAlias(`${targetPath}.${key}`, jsxAttributeValue(attribute, aliases), aliases);
  }
  return targetPath;
}

function collectAliases(sourceFile) {
  const aliases = new Map();
  const functions = new Map();
  const collectDeclarations = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node);
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const sourcePath = accessPath(node.initializer, aliases);
      if (sourcePath && ts.isIdentifier(node.name)) {
        aliases.set(node.name.text, sourcePath);
      } else if (sourcePath && ts.isObjectBindingPattern(node.name)) {
        bindPattern(node.name, sourcePath, aliases);
      } else if (ts.isIdentifier(node.name) && ts.isObjectLiteralExpression(node.initializer)) {
        const objectName = node.name.text;
        clearAliasTree(objectName, aliases);
        applyObjectMembers(objectName, node.initializer, aliases);
      }
      if (
        ts.isIdentifier(node.name) &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
      ) {
        functions.set(node.name.text, node.initializer);
      }
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const sourcePath = materializeExpression(
        node.right,
        `assigned_${node.getStart(sourceFile)}`,
        aliases,
      );
      if (sourcePath) bindPattern(node.left, sourcePath, aliases);
    }
    ts.forEachChild(node, collectDeclarations);
  };
  collectDeclarations(sourceFile);

  const bindParameters = (callable, sourcePath) => {
    const parameter = callable.parameters[0];
    if (parameter) bindPattern(parameter.name, sourcePath, aliases);
  };
  const collectParameterAliases = (node) => {
    if (ts.isJsxOpeningLikeElement(node) && ts.isIdentifier(node.tagName)) {
      const callable = functions.get(node.tagName.text);
      if (callable) {
        const sourcePath = materializeJsxProps(
          node,
          `jsx_${node.tagName.text}_${node.getStart(sourceFile)}`,
          aliases,
        );
        bindParameters(callable, sourcePath);
      }
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const callable = functions.get(node.expression.text);
      const sourcePath = node.arguments[0]
        ? materializeExpression(
            node.arguments[0],
            `call_${node.expression.text}_${node.getStart(sourceFile)}`,
            aliases,
          )
        : null;
      if (callable && sourcePath) bindParameters(callable, sourcePath);
    }
    ts.forEachChild(node, collectParameterAliases);
  };
  collectParameterAliases(sourceFile);
  return aliases;
}

function isVisibleAliasUse(node) {
  const parent = node.parent;
  if (ts.isJsxExpression(parent)) return true;
  if (ts.isPropertyAssignment(parent)) return isUiName(propertyName(parent.name) ?? "");
  if (ts.isCallExpression(parent)) return isDisplayCall(parent);
  if (
    ts.isConditionalExpression(parent) ||
    ts.isParenthesizedExpression(parent) ||
    (ts.isBinaryExpression(parent) &&
      (parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
        parent.operatorToken.kind === ts.SyntaxKind.BarBarToken))
  ) {
    return isVisibleAliasUse(parent);
  }
  return false;
}

function normalizedRuleFile(fileName) {
  return fileName.replaceAll("\\", "/").replace(/^.*?(?=src\/)/, "");
}

function allowedReason(relativeFile) {
  for (const [prefix, reason] of FILE_ALLOWLIST) {
    if (relativeFile === prefix || relativeFile.startsWith(prefix)) return reason;
  }
  return null;
}

export function inspectSource(source, fileName = "copy.tsx") {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const findings = [];
  const rawAccesses = RAW_ACCESS_RULES.get(normalizedRuleFile(fileName));
  const aliases = collectAliases(sourceFile);
  const visit = (node) => {
    if (
      rawAccesses &&
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node) ||
        (ts.isIdentifier(node) && aliases.has(node.text) && isVisibleAliasUse(node)))
    ) {
      const access = accessPath(node, aliases);
      if (access && rawAccesses.has(access)) {
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        findings.push({ line: start.line + 1, rule: "campo dinámico crudo", text: access });
      }
    }
    const text = literalText(node);
    if (text !== null && isVisibleLiteral(node)) {
      for (const rule of FORBIDDEN_COPY) {
        if (rule.pattern.test(text)) {
          const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          findings.push({ line: start.line + 1, rule: rule.name, text: text.trim() });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return findings;
}

export function inspectProject() {
  return SOURCE_ROOTS.flatMap((root) =>
    walk(root).flatMap((file) => {
      const relativeFile = path.relative(process.cwd(), file).split(path.sep).join("/");
      if (allowedReason(relativeFile)) return [];
      return inspectSource(fs.readFileSync(file, "utf8"), file).map((finding) => ({
        ...finding,
        file: relativeFile,
      }));
    }),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const findings = inspectProject();
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(`${finding.file}:${finding.line} [${finding.rule}] ${finding.text}`);
    }
    process.exitCode = 1;
  }
}
