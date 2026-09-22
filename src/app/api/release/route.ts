import { NextResponse } from "next/server";
import { getReleaseMetadata } from "@/lib/release-metadata";

export const dynamic = "force-dynamic";

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
