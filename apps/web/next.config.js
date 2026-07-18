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
  // Lint ayrı bir adım (`npm run lint`); production build'de çalıştırma.
  // Monorepo'da eslint-config-next parser çözümü kararsız olabildiği için
  // Vercel build'ini deterministik ve hızlı tutmak adına devre dışı.
  // Tip güvenliği korunur: tsc build sırasında yine de hataları yakalar.
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
