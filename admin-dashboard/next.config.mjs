/** @type {import('next').NextConfig} */

// Opt-in basePath so this app can be stitched under one origin by the BTS
// Console (set NEXT_PUBLIC_BASE_PATH=/onboarding in that deployment). Left unset,
// the app still deploys standalone at the root exactly as before.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined

const nextConfig = {
  reactStrictMode: true,
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
};

export default nextConfig;
