#!/usr/bin/env python3
"""Validate a repository's adoption of the Tooxs AI Factory Framework."""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

VERSION = "1.0.0"
REQUIRED_FILES = (
    "AGENTS.md",
    "CLAUDE.md",
    "docs/factory/FACTORY_POLICY.md",
    "docs/factory/PROJECT_POLICY.md",
    "docs/factory/FACTORY_VERSION",
    "docs/factory/FRAMEWORK_SOURCE",
    "scripts/tooxs_factory_check.py",
    ".github/workflows/tooxs-factory-conformance.yml",
)


def normalized(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in value if not unicodedata.combining(ch)).lower()


def contains_any(text: str, alternatives: tuple[str, ...]) -> bool:
    return any(normalized(item) in text for item in alternatives)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=".")
    parser.add_argument("--json", action="store_true", dest="as_json")
    args = parser.parse_args()

    repo = Path(args.repo).resolve()
    checks: list[dict[str, object]] = []

    def check(ok: bool, label: str) -> None:
        checks.append({"status": "PASS" if ok else "FAIL", "check": label})

    for rel in REQUIRED_FILES:
        check((repo / rel).is_file(), f"required file: {rel}")

    version_file = repo / "docs/factory/FACTORY_VERSION"
    if version_file.is_file():
        check(version_file.read_text(encoding="utf-8").strip() == VERSION, f"core version == {VERSION}")

    source_file = repo / "docs/factory/FRAMEWORK_SOURCE"
    if source_file.is_file():
        source = source_file.read_text(encoding="utf-8", errors="replace")
        check("tooxs-digital/Tooxs-AI-Factory-Framework" in source, "corporate framework repository pinned")
        check(re.search(r"(?im)^version\s*[:=]\s*v?1\.0\.0\s*$", source) is not None, "framework version pinned")
        check(re.search(r"(?im)^commit\s*[:=]\s*[0-9a-f]{40}\s*$", source) is not None, "immutable framework commit pinned")
        check(not re.search(r"(?im)^commit\s*[:=]\s*(main|master|latest)\s*$", source), "no mutable source ref")

    agents_file = repo / "AGENTS.md"
    if agents_file.is_file():
        agents = normalized(agents_file.read_text(encoding="utf-8", errors="replace"))
        check(contains_any(agents, ("factory_policy", "factory policy")), "AGENTS references factory policy")
        check(contains_any(agents, ("project_policy", "project policy")), "AGENTS references project overlay")
        check(contains_any(agents, ("source of truth", "fuente de verdad")), "AGENTS defines source of truth")

    policy_file = repo / "docs/factory/FACTORY_POLICY.md"
    if policy_file.is_file():
        policy = normalized(policy_file.read_text(encoding="utf-8", errors="replace"))
        for risk in ("r0", "r1", "r2"):
            check(risk in policy, f"risk class {risk.upper()} defined")
        check(contains_any(policy, ("independent review", "revision independiente", "review independiente", "revisor independiente", "reviewer independiente")), "independent review policy present")
        check(contains_any(policy, ("human gate", "aprobacion humana", "gate humano")), "human gate policy present")
        check(contains_any(policy, ("subscription", "suscripcion")), "subscription policy present")
        check(contains_any(policy, ("paid usage", "paid credits", "uso pagado", "uso incremental pagado", "creditos adicionales")), "incremental paid usage policy present")
        check(contains_any(policy, ("provider-neutral", "provider neutral", "agnostic", "agnostico", "llm is replaceable", "llm es reemplazable")), "provider neutrality policy present")
        check(contains_any(policy, ("mechanically enforced", "mechanically verifiable", "mecanicamente exigido", "mecanicamente verificable", "cumplir mecanicamente", "enforcement")), "mechanical enforcement policy present")

    adapter_file = repo / "CLAUDE.md"
    if adapter_file.is_file():
        adapter = normalized(adapter_file.read_text(encoding="utf-8", errors="replace"))
        check(len(adapter.splitlines()) <= 80, "provider adapter is concise")
        check("agents.md" in adapter, "provider adapter delegates to AGENTS")

    workflow_file = repo / ".github/workflows/tooxs-factory-conformance.yml"
    if workflow_file.is_file():
        workflow = workflow_file.read_text(encoding="utf-8", errors="replace")
        check("scripts/tooxs_factory_check.py" in workflow, "CI invokes vendored checker")
        check("--json" in workflow, "CI emits machine-readable conformance result")
        check("Tooxs-AI-Factory-Framework@main" not in workflow, "CI has no mutable private cross-repo dependency")

    failures = [item for item in checks if item["status"] == "FAIL"]
    result = {"framework_version": VERSION, "repository": str(repo), "status": "PASS" if not failures else "FAIL", "failures": len(failures), "checks": checks}
    if args.as_json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        for item in checks:
            print(item["status"], item["check"])
        print(f"RESULT: {result['status']} ({len(failures)} failure(s))")
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
