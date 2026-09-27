const SHA_RE = /^[0-9a-f]{40}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const IMAGE_RE = /^[a-z0-9][a-z0-9._/-]*@sha256:[0-9a-f]{64}$/;

export const RELEASE_PROVENANCE_SCHEMA_VERSION = 2;

export type ReleaseEnvironment = {
  QAVANTE_RELEASE_SHA?: string;
  QAVANTE_RELEASE_TREE_SHA?: string;
  QAVANTE_RELEASE_BUNDLE_SHA256?: string;
  QAVANTE_RELEASE_VERSION?: string;
  QAVANTE_RELEASE_IMAGE_REF?: string;
};

export function getReleaseMetadata(env: ReleaseEnvironment = process.env as ReleaseEnvironment) {
  const sourceSha = env.QAVANTE_RELEASE_SHA ?? null;
  const sourceTree = env.QAVANTE_RELEASE_TREE_SHA ?? null;
  const bundleSha256 = env.QAVANTE_RELEASE_BUNDLE_SHA256 ?? null;
  const version = env.QAVANTE_RELEASE_VERSION ?? null;
  const imageRef = env.QAVANTE_RELEASE_IMAGE_REF ?? null;
  const complete = Boolean(
    sourceSha &&
    SHA_RE.test(sourceSha) &&
    sourceTree &&
    SHA_RE.test(sourceTree) &&
    bundleSha256 &&
    SHA256_RE.test(bundleSha256) &&
    version &&
    VERSION_RE.test(version) &&
    imageRef &&
    IMAGE_RE.test(imageRef),
  );
  return { complete, sourceSha, sourceTree, bundleSha256, version, imageRef };
}
