// ============================================================================
// ŞEMA HİZALAMASI — SQL ↔ TypeScript ↔ servis sorguları.
//
// Supabase şeması (supabase/schema.sql) ile TypeScript tipleri
// (packages/core/src/supabase/database.types.ts) ELLE senkron tutuluyor.
// Biri diğerinden ayrıştığında TypeScript memnun kalır ama çalışma zamanında
// veri sessizce kaybolur: yazılan kolon yoktur, okunan alan `undefined` gelir.
//
// Bu testler üç kaynağı karşılaştırır:
//   1) schema.sql'deki CREATE TABLE kolonları
//   2) database.types.ts'deki Row alanları
//   3) servislerin `.from('tablo')` çağrıları
// ============================================================================
import { describe, expect, it } from 'vitest'
import { VALIDATION_RULES } from '@nutrition/core'
import { allProjectSources, codeOf, readRepoFile } from '../helpers/source-scan'

const sql = readRepoFile('supabase/schema.sql')
const typesSource = readRepoFile('packages/core/src/supabase/database.types.ts')
const sources = allProjectSources()

// ---------------------------------------------------------------------------
// SQL ayrıştırma
// ---------------------------------------------------------------------------
const NON_COLUMN_KEYWORDS = /^(UNIQUE|PRIMARY|FOREIGN|CHECK|CONSTRAINT|EXCLUDE)\b/i

/** schema.sql içindeki tabloları ve kolonlarını çıkarır. */
function parseSqlTables(): Map<string, string[]> {
  const tables = new Map<string, string[]>()
  const tableRe = /CREATE TABLE public\.(\w+)\s*\(([\s\S]*?)\n\);/g

  for (const match of sql.matchAll(tableRe)) {
    const [, table, body] = match
    const columns = body
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('--') && !NON_COLUMN_KEYWORDS.test(line))
      .map((line) => line.match(/^([a-z_][a-z0-9_]*)\s+[A-Za-z]/)?.[1])
      .filter((name): name is string => Boolean(name))

    tables.set(table, columns)
  }
  return tables
}

/** database.types.ts içinde bir tablonun Row alanlarını çıkarır. */
function parseRowFields(table: string): string[] {
  const tableIndex = typesSource.indexOf(`      ${table}: {`)
  if (tableIndex === -1) return []

  const rowIndex = typesSource.indexOf('Row: {', tableIndex)
  if (rowIndex === -1) return []

  // Süslü parantez sayarak Row bloğunu ayıkla.
  let depth = 0
  let end = rowIndex
  for (let i = typesSource.indexOf('{', rowIndex); i < typesSource.length; i++) {
    if (typesSource[i] === '{') depth++
    else if (typesSource[i] === '}') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }

  const block = typesSource.slice(rowIndex, end)
  return [...block.matchAll(/^\s{10}([a-z_][a-z0-9_]*):/gm)].map((m) => m[1])
}

const sqlTables = parseSqlTables()

describe('şema ayrıştırma', () => {
  it('beklenen tabloları bulur', () => {
    expect([...sqlTables.keys()].sort()).toEqual([
      'daily_progress',
      'meal_logs',
      'nutrition_plans',
      'user_profiles',
      'weight_logs',
    ])
  })

  it('her tabloda kolon bulur (ayrıştırıcı bozulmamış)', () => {
    for (const [table, columns] of sqlTables) {
      expect(columns.length, table).toBeGreaterThan(3)
      expect(columns, table).toContain('id')
    }
  })
})

describe('SQL ↔ TypeScript tipleri', () => {
  it('her SQL tablosunun bir TypeScript karşılığı vardır', () => {
    for (const table of sqlTables.keys()) {
      expect(typesSource, table).toContain(`${table}: {`)
    }
  })

  it.each([...sqlTables.keys()])('%s: tüm SQL kolonları Row tipinde var', (table) => {
    const sqlColumns = sqlTables.get(table)!
    const rowFields = parseRowFields(table)

    expect(rowFields.length, `${table} Row tipi ayrıştırılamadı`).toBeGreaterThan(0)
    for (const column of sqlColumns) {
      expect(rowFields, `${table}.${column} TypeScript tipinde eksik`).toContain(column)
    }
  })

  it.each([...sqlTables.keys()])('%s: Row tipinde uydurma alan yok', (table) => {
    const sqlColumns = new Set(sqlTables.get(table)!)
    for (const field of parseRowFields(table)) {
      expect(sqlColumns.has(field), `${table}.${field} SQL şemasında yok`).toBe(true)
    }
  })

  it('dışa aktarılan satır tipleri tabloları kapsar', () => {
    for (const exported of [
      'UserProfile',
      'NutritionPlan',
      'MealLog',
      'DailyProgressRow',
      'WeightLog',
    ]) {
      expect(typesSource).toContain(`export type ${exported} =`)
    }
  })
})

describe('servis sorguları ↔ şema', () => {
  /** Kaynak kodda geçen tüm `.from('tablo')` çağrıları. */
  const usedTables = new Set(
    sources.flatMap((file) => [...codeOf(file).matchAll(/\.from\(\s*['"](\w+)['"]/g)].map((m) => m[1]))
  )

  it('sorgular gerçekten tespit ediliyor', () => {
    expect(usedTables.size).toBeGreaterThan(2)
  })

  it('yalnızca şemada tanımlı tablolar sorgulanır', () => {
    for (const table of usedTables) {
      expect(sqlTables.has(table), `${table} tablosu schema.sql'de yok`).toBe(true)
    }
  })

  it('sorgularda kullanılan kolonlar şemada vardır', () => {
    // `.eq('kolon', ...)`, `.order('kolon')`, `.gte('kolon', ...)` çağrıları.
    const allColumns = new Set([...sqlTables.values()].flat())
    const filterCalls = sources.flatMap((file) =>
      [...codeOf(file).matchAll(/\.(eq|neq|lt|lte|gt|gte|order)\(\s*['"]([a-z_]+)['"]/g)].map(
        (m) => ({ file: file.rel, column: m[2] })
      )
    )

    expect(filterCalls.length).toBeGreaterThan(5)
    for (const { file, column } of filterCalls) {
      expect(allColumns.has(column), `${file} → "${column}" kolonu şemada yok`).toBe(true)
    }
  })
})

describe('güvenlik: satır düzeyi güvenlik (RLS)', () => {
  it.each([...sqlTables.keys()])('%s tablosunda RLS açıktır', (table) => {
    expect(sql).toMatch(
      new RegExp(`ALTER TABLE public\\.${table}\\s+ENABLE ROW LEVEL SECURITY`, 'i')
    )
  })

  it.each([...sqlTables.keys()])('%s tablosunda politika tanımlıdır', (table) => {
    expect(sql).toMatch(new RegExp(`ON public\\.${table} FOR SELECT`, 'i'))
  })

  it('politikalar kullanıcıyı auth.uid() ile sınırlar', () => {
    const policyBlocks = sql.match(/CREATE POLICY[\s\S]*?;/g) ?? []
    expect(policyBlocks.length).toBeGreaterThan(10)
    for (const block of policyBlocks) {
      expect(block, block.slice(0, 60)).toMatch(/auth\.uid\(\)/)
    }
  })

  it('trigger fonksiyonları REST üzerinden çağrılamaz', () => {
    // RPC olarak açık kalırlarsa kullanıcı ilerleme kayıtlarını manipüle edebilir.
    for (const fn of [
      'create_user_profile',
      'update_daily_progress_on_meal',
      'update_daily_progress_on_meal_delete',
      'update_updated_at_column',
    ]) {
      expect(sql).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${fn}\\(\\)`))
    }
  })

  it('fonksiyonlar sabit search_path kullanır', () => {
    const functions = sql.match(/CREATE OR REPLACE FUNCTION[\s\S]*?LANGUAGE plpgsql[^;]*/g) ?? []
    expect(functions.length).toBeGreaterThan(2)
    for (const fn of functions) {
      expect(fn, fn.slice(0, 60)).toContain('SET search_path')
    }
  })
})

describe('SQL kısıtları ↔ uygulama kuralları', () => {
  it('meal_count kısıtı VALIDATION_RULES ile aynıdır', () => {
    const { min, max } = VALIDATION_RULES.mealCount
    expect(sql).toContain(`CHECK (meal_count >= ${min} AND meal_count <= ${max})`)
  })

  it('confidence_score 0-1 aralığındadır (parse.ts aynı aralığa normalize eder)', () => {
    expect(sql).toMatch(/confidence_score[\s\S]{0,80}CHECK \(confidence_score >= 0 AND confidence_score <= 1\)/)
  })

  it('cinsiyet/aktivite/hedef kısıtları alan tipleriyle aynıdır', () => {
    expect(sql).toContain("gender IN ('male', 'female', 'other')")
    expect(sql).toContain(
      "activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')"
    )
    expect(sql).toContain("goal IN ('lose_weight', 'gain_weight', 'build_muscle', 'maintain')")
  })

  it('makro ve kalori kolonları negatif olamaz', () => {
    for (const column of ['total_calories', 'total_protein_g', 'total_carbs_g', 'total_fat_g']) {
      expect(sql, column).toMatch(new RegExp(`CHECK \\(${column} >= 0\\)`))
    }
  })

  it('günlük ilerleme ve kilo kayıtları kullanıcı+tarih için tekildir', () => {
    // saveWeightLog `onConflict: 'user_id,date'` ile upsert yapar; bu kısıt şart.
    const uniqueConstraints = sql.match(/UNIQUE\(user_id, date\)/g) ?? []
    expect(uniqueConstraints.length).toBeGreaterThanOrEqual(2)
  })
})
