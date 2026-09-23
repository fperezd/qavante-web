"""Compare every archived source entry with the extracted Docker context."""

from __future__ import annotations

import argparse
import os
import tarfile
from pathlib import Path


def verify(archive: Path, source: Path) -> None:
    root = source.resolve()
    with tarfile.open(archive, "r:") as bundle:
        for member in bundle:
            target = (root / member.name).resolve(strict=False)
            if not target.is_relative_to(root):
                raise ValueError(f"unsafe archive path: {member.name}")
            if member.isdir():
                if not target.is_dir():
                    raise ValueError(f"missing directory: {member.name}")
            elif member.isfile():
                original = bundle.extractfile(member)
                if original is None or not target.is_file() or target.read_bytes() != original.read():
                    raise ValueError(f"source differs from archive: {member.name}")
            elif member.issym():
                if not target.is_symlink() or os.readlink(target) != member.linkname:
                    raise ValueError(f"symlink differs from archive: {member.name}")
            else:
                raise ValueError(f"unsupported archive entry: {member.name}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    verify(args.archive, args.source)
