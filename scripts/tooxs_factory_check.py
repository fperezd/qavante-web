#!/usr/bin/env python3
from pathlib import Path
import sys

VERSION = "1.0.0"
repo = Path(sys.argv[sys.argv.index("--repo") + 1] if "--repo" in sys.argv else ".").resolve()
failures = []

def check(ok, label):
    print(("PASS" if ok else "FAIL"), label)
    if not ok:
        failures.append(label)

for rel in ["AGENTS.md", "docs/factory/FACTORY_POLICY.md", "docs/factory/PROJECT_POLICY.md", "docs/factory/FACTORY_VERSION"]:
    check((repo / rel).is_file(), f"required file: {rel}")

vf = repo / "docs/factory/FACTORY_VERSION"
if vf.is_file():
    check(vf.read_text(encoding="utf-8").strip() == VERSION, f"core version == {VERSION}")

ag = repo / "AGENTS.md"
if ag.is_file():
    text = ag.read_text(encoding="utf-8", errors="replace").lower()
    check("factory_policy" in text or "factory policy" in text, "AGENTS references factory policy")
    check("project_policy" in text or "project policy" in text, "AGENTS references project overlay")
    check("source of truth" in text, "AGENTS defines source of truth")

policy = repo / "docs/factory/FACTORY_POLICY.md"
if policy.is_file():
    text = policy.read_text(encoding="utf-8", errors="replace").lower()
    for risk in ["r0", "r1", "r2"]:
        check(risk in text, f"risk class {risk.upper()} defined")
    check("independent" in text, "independent review policy present")
    check("human gate" in text, "human gate policy present")
    check("subscription" in text, "subscription policy present")

claude = repo / "CLAUDE.md"
if claude.is_file():
    check(len(claude.read_text(encoding="utf-8", errors="replace").splitlines()) <= 80, "CLAUDE adapter concise")

print(f"RESULT: {'PASS' if not failures else 'FAIL'} ({len(failures)} failure(s))")
sys.exit(0 if not failures else 1)
