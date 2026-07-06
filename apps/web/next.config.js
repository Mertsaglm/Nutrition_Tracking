/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile the workspace packages (they ship raw TS/ESM source).
  transpilePackages: ['@nutrition/core', '@nutrition/tokens'],
  reactStrictMode: true,
}

module.exports = nextConfig
