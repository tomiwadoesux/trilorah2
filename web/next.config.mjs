/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Let simultaneous local previews keep independent Next.js build caches.
  distDir: process.env.TRILORAH_NEXT_DIST_DIR || '.next',
  devIndicators: process.env.TRILORAH_NEXT_DIST_DIR ? false : undefined,
  experimental: {
    externalDir: true, // allow `import "@trilorah/shared"` from sibling folder
  },
  // `.wgsl` shaders import each other like TS modules; vgpu's loader resolves that graph
  // at build time. `next dev` here runs webpack; the turbopack block covers `--turbopack`.
  webpack(config, { dev }) {
    config.module.rules.push({
      test: /\.wgsl$/,
      loader: "@vgpu/wgsl/loader-webpack",
      options: { minify: !dev },
    });
    return config;
  },
  turbopack: {
    rules: {
      "*.wgsl": { loaders: ["@vgpu/wgsl/loader-webpack"], as: "*.js" },
    },
  },
};

export default nextConfig;
