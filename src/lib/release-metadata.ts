const SHA_RE = /^[0-9a-f]{40}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

export type ReleaseEnvironment = {
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
