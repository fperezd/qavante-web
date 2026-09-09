import { NextResponse } from "next/server";

const SHA_RE = /^[0-9a-f]{40}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

export const dynamic = "force-dynamic";

type ReleaseEnvironment = {
  QAVANTE_RELEASE_SHA?: string;
  QAVANTE_RELEASE_BUNDLE_SHA256?: string;
};

export function getReleaseMetadata(env: ReleaseEnvironment = process.env as ReleaseEnvironment) {
  const sourceSha = env.QAVANTE_RELEASE_SHA ?? null;
  const bundleSha256 = env.QAVANTE_RELEASE_BUNDLE_SHA256 ?? null;
  const complete = Boolean(
    sourceSha && SHA_RE.test(sourceSha) && bundleSha256 && SHA256_RE.test(bundleSha256),
  );
  return { complete, sourceSha, bundleSha256 };
}

export async function GET() {
  const metadata = getReleaseMetadata();
  return NextResponse.json(
    metadata.complete
      ? { status: "ok", source_sha: metadata.sourceSha, bundle_sha256: metadata.bundleSha256 }
      : { status: "unavailable", source_sha: null, bundle_sha256: null },
    {
      status: metadata.complete ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
