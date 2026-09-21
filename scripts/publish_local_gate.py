"""Publish a SHA-bound local CI status after preserving its evidence locally."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path


ALLOWED_CONTEXTS = {"local-ci", "local-change-evidence", "local-security"}


def run(*args: str) -> str:
    return subprocess.check_output(args, text=True, encoding="utf-8").strip()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--context", choices=sorted(ALLOWED_CONTEXTS), required=True)
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--description", required=True)
    args = parser.parse_args()

    if not args.evidence.is_file() or args.evidence.stat().st_size == 0:
        parser.error("evidence file is missing or empty")
    if run("git", "status", "--porcelain"):
        parser.error("working tree must be clean")

    sha = run("git", "rev-parse", "HEAD")
    tree = run("git", "rev-parse", "HEAD^{tree}")
    evidence_digest = hashlib.sha256(args.evidence.read_bytes()).hexdigest()
    actions = json.loads(run("gh", "api", f"repos/{args.repo}/actions/permissions"))
    if actions.get("enabled") is not False:
        parser.error("GitHub Actions must be disabled before publishing a local gate")

    record = {
        "schema_version": 1,
        "repository": args.repo,
        "sha": sha,
        "tree": tree,
        "context": args.context,
        "evidence_sha256": evidence_digest,
        "evidence_path": str(args.evidence.resolve()),
        "recorded_at": datetime.now(timezone.utc).isoformat(),
    }
    git_dir = Path(run("git", "rev-parse", "--git-common-dir"))
    if not git_dir.is_absolute():
        git_dir = Path.cwd() / git_dir
    output = git_dir / "local-gates" / sha / f"{args.context}.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")

    subprocess.run(
        [
            "gh", "api", "--method", "POST", f"repos/{args.repo}/statuses/{sha}",
            "-f", "state=success", "-f", f"context={args.context}",
            "-f", f"description={args.description[:140]}",
        ],
        check=True,
    )
    print(json.dumps(record))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
