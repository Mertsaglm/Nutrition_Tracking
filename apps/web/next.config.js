const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile the workspace packages (they ship raw TS/ESM source).
  transpilePackages: ['@nutrition/core', '@nutrition/tokens'],
  reactStrictMode: true,
  // Monorepo kökünü bildir (dosya izleme + lockfile uyarılarını giderir).
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
}

module.exports = nextConfig
