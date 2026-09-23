import hashlib
import unittest

from local_release_preflight import CONTEXTS, REPOSITORY, PreflightError, validate


SHA = "a" * 40
HEAD = "b" * 40
TREE = "c" * 40


def fixture():
    evidence = {context: f"proof for {context}".encode() for context in CONTEXTS}
    return {
        "sha": SHA,
        "tree": TREE,
        "main": {"sha": SHA, "commit": {"tree": {"sha": TREE}}},
        "protection": {
            "required_status_checks": {"strict": True, "contexts": list(CONTEXTS)},
            "enforce_admins": {"enabled": True},
            "allow_force_pushes": {"enabled": False},
            "allow_deletions": {"enabled": False},
        },
        "actions": {"enabled": False},
        "pulls": [{"number": 1, "merged_at": "2026-09-22", "merge_commit_sha": SHA,
                   "base": {"ref": "main"}, "head": {"sha": HEAD}}],
        "reviewed_commit": {"commit": {"tree": {"sha": TREE}}},
        "statuses": [{"context": context, "state": "success", "creator": {"login": "fperezd"},
                      "created_at": "2026-09-22T00:00:00Z", "id": index}
                     for index, context in enumerate(CONTEXTS)],
        "records": {context: {"schema_version": 1, "repository": REPOSITORY, "sha": HEAD,
                              "tree": TREE, "context": context,
                              "evidence_sha256": hashlib.sha256(evidence[context]).hexdigest()}
                    for context in CONTEXTS},
        "evidence": evidence,
        "actor": "fperezd",
    }


class ReleasePreflightTests(unittest.TestCase):
    def test_accepts_exact_reviewed_tree_and_evidence(self):
        result = validate(**fixture())
        self.assertEqual(result["release_sha"], SHA)
        self.assertEqual(result["reviewed_head_sha"], HEAD)
        self.assertEqual(set(result["gate_evidence_sha256"]), set(CONTEXTS))

    def test_blocks_tree_mismatch(self):
        data = fixture()
        data["reviewed_commit"]["commit"]["tree"]["sha"] = "d" * 40
        with self.assertRaisesRegex(PreflightError, "reviewed PR tree differs"):
            validate(**data)

    def test_blocks_disabled_protection(self):
        data = fixture()
        data["protection"]["enforce_admins"]["enabled"] = False
        with self.assertRaisesRegex(PreflightError, "admin enforcement"):
            validate(**data)

    def test_blocks_actions_enabled(self):
        data = fixture()
        data["actions"]["enabled"] = True
        with self.assertRaisesRegex(PreflightError, "Actions"):
            validate(**data)

    def test_blocks_later_red_status(self):
        data = fixture()
        data["statuses"].append({"context": "local-ci", "state": "failure",
                                 "creator": {"login": "fperezd"},
                                 "created_at": "2026-09-22T01:00:00Z", "id": 20})
        with self.assertRaisesRegex(PreflightError, "local-ci is not green"):
            validate(**data)

    def test_blocks_other_publisher(self):
        data = fixture()
        data["statuses"][0]["creator"]["login"] = "someone-else"
        with self.assertRaisesRegex(PreflightError, "different publisher"):
            validate(**data)

    def test_blocks_changed_evidence(self):
        data = fixture()
        data["evidence"]["local-security"] = b"changed"
        with self.assertRaisesRegex(PreflightError, "evidence is missing or changed"):
            validate(**data)

    def test_blocks_missing_gate(self):
        data = fixture()
        data["protection"]["required_status_checks"]["contexts"].remove("local-security")
        with self.assertRaisesRegex(PreflightError, "exactly the local gates"):
            validate(**data)


if __name__ == "__main__":
    unittest.main()
