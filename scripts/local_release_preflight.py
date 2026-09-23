"""Verify the exact local CI evidence before preparing a production artifact."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path


REPOSITORY = "tooxs-digital/qavante-web"
CONTEXTS = ("local-ci", "local-change-evidence", "local-security")
SHA = re.compile(r"^[0-9a-f]{40}$")
DIGEST = re.compile(r"^[0-9a-f]{64}$")


class PreflightError(Exception):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise PreflightError(message)


def command(*args: str) -> str:
    return subprocess.check_output(args, text=True, encoding="utf-8").strip()


def github(path: str) -> object:
    return json.loads(command("gh", "api", f"repos/{REPOSITORY}/{path}"))


def validate(
    *,
    sha: str,
    tree: str,
    main: dict,
    protection: dict,
    actions: dict,
    pulls: list[dict],
    reviewed_commit: dict,
    statuses: list[dict],
    records: dict[str, dict],
    evidence: dict[str, bytes],
    actor: str,
) -> dict:
    require(bool(SHA.fullmatch(sha)) and bool(SHA.fullmatch(tree)), "invalid local SHA or tree")
    require(main.get("sha") == sha, "local HEAD is not the current remote main")
    require(main.get("commit", {}).get("tree", {}).get("sha") == tree, "main tree differs")
    require(actions.get("enabled") is False, "Actions must remain disabled")
    checks = protection.get("required_status_checks") or {}
    require(checks.get("strict") is True, "main must require an up-to-date branch")
    require(set(CONTEXTS) == set(checks.get("contexts") or []), "main does not require exactly the local gates")
    require(protection.get("enforce_admins", {}).get("enabled") is True, "admin enforcement is off")
    require(protection.get("allow_force_pushes", {}).get("enabled") is False, "force pushes are allowed")
    require(protection.get("allow_deletions", {}).get("enabled") is False, "branch deletion is allowed")

    merged = [
        pull for pull in pulls
        if pull.get("merged_at") and pull.get("merge_commit_sha") == sha
        and pull.get("base", {}).get("ref") == "main"
    ]
    require(len(merged) == 1, "main commit has no unique merged PR")
    pull = merged[0]
    head = pull.get("head", {}).get("sha")
    require(isinstance(head, str) and bool(SHA.fullmatch(head)), "reviewed head is invalid")
    require(reviewed_commit.get("commit", {}).get("tree", {}).get("sha") == tree,
            "reviewed PR tree differs from main")

    latest: dict[str, dict] = {}
    for status in statuses:
        context = status.get("context")
        current = latest.get(context)
        if current is None or (status.get("created_at", ""), status.get("id", 0)) > (
            current.get("created_at", ""), current.get("id", 0)
        ):
            latest[context] = status

    proofs = {}
    for context in CONTEXTS:
        status = latest.get(context)
        require(status is not None and status.get("state") == "success", f"{context} is not green")
        require(status.get("creator", {}).get("login") == actor, f"{context} has a different publisher")
        record = records.get(context) or {}
        require(record.get("schema_version") == 1 and record.get("repository") == REPOSITORY,
                f"{context} record identity differs")
        require(record.get("sha") == head and record.get("tree") == tree
                and record.get("context") == context, f"{context} record is for another tree")
        digest = record.get("evidence_sha256")
        require(isinstance(digest, str) and bool(DIGEST.fullmatch(digest)),
                f"{context} evidence digest is invalid")
        contents = evidence.get(context)
        require(bool(contents) and hashlib.sha256(contents).hexdigest() == digest,
                f"{context} evidence is missing or changed")
        proofs[context] = digest

    return {
        "schema_version": 1,
        "repository": REPOSITORY,
        "release_sha": sha,
        "release_tree": tree,
        "reviewed_pull_request": pull["number"],
        "reviewed_head_sha": head,
        "gate_evidence_sha256": proofs,
    }


def preflight() -> tuple[dict, dict[str, bytes]]:
    require(not command("git", "status", "--porcelain"), "working tree is not clean")
    sha = command("git", "rev-parse", "HEAD")
    tree = command("git", "rev-parse", "HEAD^{tree}")
    require(command("git", "rev-parse", "origin/main") == sha, "local origin/main differs")
    main = github("commits/main")
    pulls = github(f"commits/{sha}/pulls?per_page=100")
    require(isinstance(pulls, list), "GitHub PR response is invalid")
    merged = [pull for pull in pulls if pull.get("merge_commit_sha") == sha]
    require(len(merged) == 1, "cannot identify the reviewed PR")
    head = merged[0].get("head", {}).get("sha")
    require(isinstance(head, str) and bool(SHA.fullmatch(head)), "reviewed head is invalid")
    common = Path(command("git", "rev-parse", "--git-common-dir")).resolve()
    records = {}
    evidence = {}
    for context in CONTEXTS:
        path = common / "local-gates" / head / f"{context}.json"
        require(path.is_file(), f"missing local record for {context}")
        record = json.loads(path.read_text(encoding="utf-8"))
        records[context] = record
        evidence_path = Path(record.get("evidence_path", ""))
        require(evidence_path.is_file(), f"missing evidence for {context}")
        evidence[context] = evidence_path.read_bytes()
    statuses = github(f"commits/{head}/statuses?per_page=100")
    require(isinstance(statuses, list) and len(statuses) < 100, "status history is incomplete")
    result = validate(
        sha=sha,
        tree=tree,
        main=main,
        protection=github("branches/main/protection"),
        actions=github("actions/permissions"),
        pulls=pulls,
        reviewed_commit=github(f"commits/{head}"),
        statuses=statuses,
        records=records,
        evidence=evidence,
        actor=json.loads(command("gh", "api", "user"))["login"],
    )
    result["verified_at"] = datetime.now(timezone.utc).isoformat()
    return result, evidence


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        result, evidence = preflight()
        args.output.parent.mkdir(parents=True, exist_ok=True)
        proof_dir = args.output.parent / f"{args.output.stem}-evidence"
        proof_dir.mkdir()
        for context, contents in evidence.items():
            with (proof_dir / f"{context}.evidence").open("xb") as stream:
                stream.write(contents)
        result["gate_evidence_directory"] = str(proof_dir.resolve())
        with args.output.open("x", encoding="utf-8") as stream:
            json.dump(result, stream, indent=2)
            stream.write("\n")
    except (PreflightError, OSError, subprocess.CalledProcessError, ValueError, KeyError) as error:
        parser.exit(1, f"release preflight blocked: {error}\n")
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
