import { NextResponse } from "next/server";
import { getReleaseMetadata, RELEASE_PROVENANCE_SCHEMA_VERSION } from "@/lib/release-metadata";

export const dynamic = "force-dynamic";

export async function GET() {
  const metadata = getReleaseMetadata();
  return NextResponse.json(
    metadata.complete
      ? {
          status: "ok",
          provenance_schema_version: RELEASE_PROVENANCE_SCHEMA_VERSION,
          source_sha: metadata.sourceSha,
          source_tree: metadata.sourceTree,
          bundle_sha256: metadata.bundleSha256,
          version: metadata.version,
          image_ref: metadata.imageRef,
        }
      : {
          status: "unavailable",
          provenance_schema_version: RELEASE_PROVENANCE_SCHEMA_VERSION,
          source_sha: null,
          source_tree: null,
          bundle_sha256: null,
          version: null,
          image_ref: null,
        },
    {
      status: metadata.complete ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
