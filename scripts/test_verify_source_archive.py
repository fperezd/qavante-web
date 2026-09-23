import io
import tarfile
import tempfile
import unittest
from pathlib import Path

from verify_source_archive import verify


class VerifyArchiveTests(unittest.TestCase):
    def test_rejects_changed_source(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "source.tar"
            source = root / "source"
            source.mkdir()
            with tarfile.open(archive, "w") as bundle:
                entry = tarfile.TarInfo("app.txt")
                entry.size = 4
                bundle.addfile(entry, io.BytesIO(b"safe"))
            (source / "app.txt").write_bytes(b"safe")
            verify(archive, source)
            (source / "app.txt").write_bytes(b"evil")
            with self.assertRaisesRegex(ValueError, "differs"):
                verify(archive, source)

    def test_rejects_parent_path(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "source.tar"
            source = root / "source"
            source.mkdir()
            with tarfile.open(archive, "w") as bundle:
                entry = tarfile.TarInfo("../escape.txt")
                entry.size = 4
                bundle.addfile(entry, io.BytesIO(b"evil"))
            with self.assertRaisesRegex(ValueError, "unsafe"):
                verify(archive, source)


if __name__ == "__main__":
    unittest.main()
