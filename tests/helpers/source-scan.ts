// ============================================================================
// Kaynak dosya tarayıcı — "guard" (sözleşme) testleri için.
//
// Bu testler davranışı değil, PROJE KURALLARINI doğrular: sırların istemciye
// sızmaması, çekirdek paketin platformdan bağımsız kalması, tarih mantığının
// UTC'ye kaymaması gibi. Kural ihlalleri derleme hatası vermez — bu yüzden
// statik olarak taranır.
//
// ÖNEMLİ: Tarama, `tests/` klasörlerini DIŞARIDA bırakır. Aksi halde yasaklı
// kalıpları arayan testin kendi metni eşleşir (yanlış pozitif).
// ============================================================================
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

/** Monorepo kökü (bu dosya tests/helpers/ altında). */
export const REPO_ROOT = path.resolve(HERE, '../..')

const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  '.expo',
  'dist',
  'build',
  'out',
  'coverage',
  'web-build',
  'tests',
  '__tests__',
  '__mocks__',
])

/** Kaynak taramasının dışında tutulan üst düzey klasörler (dokümantasyon vb.). */
const IGNORED_TOP_LEVEL = new Set(['Proje Yardımcısı - Nutrition Tracking', 'docs'])

export interface SourceFile {
  /** Repo köküne göre POSIX yolu, ör. "packages/core/src/date.ts". */
  rel: string
  abs: string
  text: string
}

export interface ScanOptions {
  /** Dahil edilecek uzantılar. Varsayılan: ts/tsx/js/jsx. */
  exts?: string[]
  /** Ek olarak atlanacak dizin adları. */
  ignoreDirs?: string[]
  /** rel yolu bu kalıplardan birine uyan dosyalar atlanır. */
  ignore?: RegExp[]
}

const DEFAULT_EXTS = ['.ts', '.tsx', '.js', '.jsx']

function walk(dir: string, ignoreDirs: Set<string>, exts: string[], acc: string[]): void {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (ignoreDirs.has(entry.name) || entry.name.startsWith('.')) continue
      walk(full, ignoreDirs, exts, acc)
    } else if (exts.includes(path.extname(entry.name))) {
      acc.push(full)
    }
  }
}

/** Verilen (repo köküne göre) dizinlerdeki kaynak dosyaları okur. */
export function scanSources(dirs: string[], options: ScanOptions = {}): SourceFile[] {
  const exts = options.exts ?? DEFAULT_EXTS
  const ignoreDirs = new Set([...DEFAULT_IGNORED_DIRS, ...(options.ignoreDirs ?? [])])
  const files: string[] = []

  for (const dir of dirs) {
    const abs = path.resolve(REPO_ROOT, dir)
    if (!fs.existsSync(abs)) continue
    if (fs.statSync(abs).isFile()) {
      files.push(abs)
      continue
    }
    walk(abs, ignoreDirs, exts, files)
  }

  return files
    .map((abs) => ({
      abs,
      rel: path.relative(REPO_ROOT, abs).split(path.sep).join('/'),
      text: fs.readFileSync(abs, 'utf8'),
    }))
    .filter((f) => !(options.ignore ?? []).some((re) => re.test(f.rel)))
    .sort((a, b) => a.rel.localeCompare(b.rel))
}

/** Uygulama + paket kaynaklarının tamamı (dokümantasyon ve testler hariç). */
export function allProjectSources(options: ScanOptions = {}): SourceFile[] {
  return scanSources(['apps', 'packages'], options).filter(
    (f) => ![...IGNORED_TOP_LEVEL].some((dir) => f.rel.startsWith(dir))
  )
}

/** Repo kökündeki bir dosyayı metin olarak okur. */
export function readRepoFile(rel: string): string {
  return fs.readFileSync(path.resolve(REPO_ROOT, rel), 'utf8')
}

export function repoFileExists(rel: string): boolean {
  return fs.existsSync(path.resolve(REPO_ROOT, rel))
}

/**
 * Yorum satırlarını çıkarır. Kural taramaları için gereklidir: bir dosya
 * "GEMINI_API_KEY burada YOK" diye YORUM yazdığında bunu ihlal saymamalıyız.
 * URL'lerdeki `://` korunur.
 */
export function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => {
      const match = line.search(/(^|[^:])\/\//)
      if (match === -1) return line
      const at = line.indexOf('//', match)
      return at === -1 ? line : line.slice(0, at)
    })
    .join('\n')
}

/** Bir dosyanın yorumsuz (yalnızca kod) hali. */
export function codeOf(file: SourceFile): string {
  return stripComments(file.text)
}

/** Bir dosyadaki tüm import/require kaynaklarını (modül isimlerini) döner. */
export function importsOf(file: SourceFile): string[] {
  const specifiers: string[] = []
  const code = stripComments(file.text)
  const patterns = [
    /\bimport\s+(?:type\s+)?[^'"]*?from\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)\s*>/g,
    /\btypeof\s+import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const re of patterns) {
    for (const match of code.matchAll(re)) specifiers.push(match[1])
  }
  return [...new Set(specifiers)]
}

/**
 * Bir metinde kalıbı arar ve eşleşen satırları `dosya:satır` biçiminde döner.
 * Guard testlerinin okunabilir hata mesajı üretmesi için.
 */
export function findLines(files: SourceFile[], pattern: RegExp): string[] {
  const hits: string[] = []
  for (const file of files) {
    const lines = file.text.split('\n')
    lines.forEach((line, index) => {
      // Her satır için yeni bir regex (global bayrağın lastIndex durumundan kaçın).
      const re = new RegExp(pattern.source, pattern.flags.replace('g', ''))
      if (re.test(line)) hits.push(`${file.rel}:${index + 1} → ${line.trim()}`)
    })
  }
  return hits
}
