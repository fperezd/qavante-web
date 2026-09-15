import type { NextConfig } from "next";

/* Los E2E OFF y ON construyen artefactos distintos. `NEXT_DIST_DIR` sólo lo
 * define Playwright; el build/deploy ordinario conserva `.next`. */
const e2eDistDir = process.env.NEXT_DIST_DIR?.trim();

const nextConfig: NextConfig = {
  ...(e2eDistDir ? { distDir: e2eDistDir } : {}),
};

export default nextConfig;
