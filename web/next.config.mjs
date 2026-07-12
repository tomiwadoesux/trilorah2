/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    externalDir: true, // allow `import "@trilorah/shared"` from sibling folder
  },
};

export default nextConfig;
