// ============================================================================
// Vitest kök yapılandırması — monorepo'nun TÜM testleri buradan çalışır.
//
//   npm test              → hepsi (tek sefer)
//   npm run test:watch    → izleme modu
//   npm run test:coverage → kapsam raporu
//   npx vitest run --project core   → tek bir proje
//
// PROJELER (her biri kendi ortamında koşar):
//   core     · packages/core       — saf iş mantığı (node)
//   tokens   · packages/tokens     — tasarım token'ları (node)
//   web      · apps/web/tests/server — API route + sunucu lib (node)
//   web-ui   · apps/web/tests/ui   — React bileşenleri (jsdom)
//   mobile   · apps/mobile         — platform servisleri (node, expo mock'lu)
//   guards   · tests/guards        — mimari/güvenlik sözleşmeleri (node)
//
// UYARI (gelecekteki geliştiriciler ve yapay zeka ajanları için):
// Bu dosyadaki `TZ` ayarı BİLEREK sabittir. Tarih mantığı "kullanıcının yerel
// günü" üzerine kuruludur; UTC'ye kayan bir regresyon ancak UTC'den farklı bir
// saat diliminde yakalanır. Değiştirmeyin — date testleri bunu doğrular.
// ============================================================================
import path from 'node:path'
import { defineConfig } from 'vitest/config'

const r = (p: string) => path.resolve(__dirname, p)

/**
 * Workspace paketleri ham TS kaynağı olarak yayınlanır. Alias'lar sayesinde
 * testler paketleri build etmeden, uygulamaların gördüğü yolla import eder.
 * DİKKAT: daha spesifik anahtar (alt yol) önce gelmeli — Vite prefix eşler.
 */
const workspaceAlias = {
  '@nutrition/tokens/tailwind-preset': r('packages/tokens/src/tailwind-preset.js'),
  '@nutrition/core': r('packages/core/src/index.ts'),
  '@nutrition/tokens': r('packages/tokens/src/index.ts'),
}

/** Tüm projelerde ortak test davranışı. */
const common = {
  clearMocks: true,
  restoreMocks: true,
  unstubEnvs: true,
  unstubGlobals: true,
  env: { TZ: 'Europe/Istanbul' },
} as const

export default defineConfig({
  test: {
    // Konsolu sessiz tutar: kod bilinçli olarak console.error ile log'luyor.
    silent: false,
    projects: [
      {
        resolve: { alias: workspaceAlias },
        test: {
          ...common,
          name: 'core',
          root: r('packages/core'),
          environment: 'node',
          include: ['tests/**/*.test.ts'],
        },
      },
      {
        resolve: { alias: workspaceAlias },
        test: {
          ...common,
          name: 'tokens',
          root: r('packages/tokens'),
          environment: 'node',
          include: ['tests/**/*.test.ts'],
        },
      },
      {
        resolve: {
          alias: { ...workspaceAlias, '@': r('apps/web') },
        },
        test: {
          ...common,
          name: 'web',
          root: r('apps/web'),
          environment: 'node',
          include: ['tests/server/**/*.test.ts'],
        },
      },
      {
        resolve: {
          alias: { ...workspaceAlias, '@': r('apps/web') },
        },
        esbuild: { jsx: 'automatic' },
        test: {
          ...common,
          name: 'web-ui',
          root: r('apps/web'),
          environment: 'jsdom',
          include: ['tests/ui/**/*.test.tsx'],
          setupFiles: [r('apps/web/tests/ui/setup.ts')],
        },
      },
      {
        resolve: { alias: workspaceAlias },
        test: {
          ...common,
          name: 'mobile',
          root: r('apps/mobile'),
          environment: 'node',
          include: ['tests/**/*.test.ts'],
        },
      },
      {
        resolve: { alias: workspaceAlias },
        test: {
          ...common,
          name: 'guards',
          root: r('.'),
          environment: 'node',
          include: ['tests/guards/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: r('coverage'),
      include: [
        'packages/core/src/**/*.ts',
        'packages/tokens/src/**/*.ts',
        'apps/web/lib/**/*.ts',
        'apps/web/app/api/**/*.ts',
        'apps/web/components/**/*.tsx',
        'apps/mobile/lib/**/*.ts',
      ],
      exclude: [
        '**/*.d.ts',
        '**/data/**',
        '**/database.types.ts',
        // Yalnızca tip tanımı içeren dosyalar (çalışma zamanı kodu yok).
        'packages/core/src/types.ts',
      ],
    },
  },
})
