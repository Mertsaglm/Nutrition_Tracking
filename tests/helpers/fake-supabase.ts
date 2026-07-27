// ============================================================================
// Sahte Supabase istemcisi — servis testleri için.
//
// AMAÇ: `createDatabaseService` / `createAuthService` gerçek ağa çıkmadan test
// edilir; ama daha önemlisi ÜRETİLEN SORGUNUN ŞEKLİ kayıt altına alınır.
// Böylece biri tablo adını, kolonu, filtreyi ya da sıralamayı değiştirdiğinde
// test kırılır — sessiz veri bozulması yerine gürültülü hata alınır.
// ============================================================================
import { vi } from 'vitest'

export interface QueryOp {
  method: string
  args: unknown[]
}

/** Servis tarafından üretilen tek bir sorgunun kaydı. */
export class RecordedQuery {
  constructor(
    readonly table: string,
    readonly ops: QueryOp[],
    readonly terminal: 'single' | 'maybeSingle' | 'await'
  ) {}

  /** Çağrılan zincir metotlarının sırası, ör. ['select','eq','eq','order']. */
  get methods(): string[] {
    return this.ops.map((o) => o.method)
  }

  op(method: string): QueryOp | undefined {
    return this.ops.find((o) => o.method === method)
  }

  has(method: string): boolean {
    return this.ops.some((o) => o.method === method)
  }

  /** İlk `method` çağrısının argümanları. */
  argsOf(method: string): unknown[] | undefined {
    return this.op(method)?.args
  }

  /** Tüm `method` çağrılarının argümanları (ör. birden çok .eq()). */
  allArgsOf(method: string): unknown[][] {
    return this.ops.filter((o) => o.method === method).map((o) => o.args)
  }

  /** `.eq('user_id', 'u1')` gibi bir filtrenin değerini döner. */
  filterValue(method: string, column: string): unknown {
    return this.ops.find((o) => o.method === method && o.args[0] === column)?.args[1]
  }

  /** insert/update/upsert ile gönderilen veri gövdesi. */
  get payload(): Record<string, unknown> | undefined {
    const op = this.ops.find((o) => ['insert', 'update', 'upsert'].includes(o.method))
    return op?.args[0] as Record<string, unknown> | undefined
  }
}

export interface QueryResult<T = unknown> {
  data: T | null
  error: { code?: string; message: string } | null
}

/** Başarılı bir sorgu sonucu. */
export function ok<T>(data: T): QueryResult<T> {
  return { data, error: null }
}

/** Hatalı bir sorgu sonucu. */
export function fail(message: string, code?: string): QueryResult<never> {
  return { data: null, error: { message, code } }
}

/** Supabase'in "satır bulunamadı" hata kodu. */
export const NO_ROWS = 'PGRST116'

/** Zincirlenebilir sorgu metotları (supabase-js yüzeyinin kullanılan kısmı). */
const CHAIN_METHODS = [
  'select',
  'insert',
  'update',
  'upsert',
  'delete',
  'eq',
  'neq',
  'lt',
  'lte',
  'gt',
  'gte',
  'in',
  'is',
  'like',
  'ilike',
  'match',
  'not',
  'filter',
  'order',
  'limit',
  'range',
] as const

export interface FakeSupabaseOptions {
  /**
   * Kaydedilen sorguya bakıp sonucu üretir. `undefined` dönerse
   * `{ data: null, error: null }` kullanılır.
   */
  respond?: (query: RecordedQuery) => QueryResult | undefined
  /** `supabase.auth.*` metotlarının dönüş değerleri. */
  auth?: Partial<Record<AuthMethod, unknown>>
}

type AuthMethod =
  | 'signUp'
  | 'signInWithPassword'
  | 'signOut'
  | 'getSession'
  | 'getUser'
  | 'onAuthStateChange'
  | 'refreshSession'
  | 'resetPasswordForEmail'

const DEFAULT_AUTH: Record<AuthMethod, unknown> = {
  signUp: { data: { user: null, session: null }, error: null },
  signInWithPassword: { data: { user: null, session: null }, error: null },
  signOut: { error: null },
  getSession: { data: { session: null }, error: null },
  getUser: { data: { user: null }, error: null },
  onAuthStateChange: { data: { subscription: { unsubscribe: () => {} } } },
  refreshSession: { data: { session: null }, error: null },
  resetPasswordForEmail: { data: {}, error: null },
}

export interface FakeSupabase {
  /** Servise geçilecek istemci (TypedSupabaseClient gibi davranır). */
  client: any
  /** Üretilen tüm sorgular — çağrı sırasıyla. */
  queries: RecordedQuery[]
  /** Belirli bir tabloya yapılan sorgular. */
  queriesFor(table: string): RecordedQuery[]
  /** Tek sorgu bekleniyorsa kısayol (birden fazlaysa hata fırlatır). */
  onlyQuery(): RecordedQuery
  auth: Record<AuthMethod, ReturnType<typeof vi.fn>>
  reset(): void
}

export function createFakeSupabase(options: FakeSupabaseOptions = {}): FakeSupabase {
  const queries: RecordedQuery[] = []
  const respond = options.respond ?? (() => undefined)

  const auth = Object.fromEntries(
    (Object.keys(DEFAULT_AUTH) as AuthMethod[]).map((method) => {
      const value = options.auth?.[method] ?? DEFAULT_AUTH[method]
      return [method, vi.fn().mockResolvedValue(value)]
    })
  ) as Record<AuthMethod, ReturnType<typeof vi.fn>>

  function createBuilder(table: string) {
    const ops: QueryOp[] = []

    const settle = (terminal: 'single' | 'maybeSingle' | 'await') => {
      const query = new RecordedQuery(table, [...ops], terminal)
      queries.push(query)
      return Promise.resolve(respond(query) ?? { data: null, error: null })
    }

    const builder: Record<string, unknown> = {}

    for (const method of CHAIN_METHODS) {
      builder[method] = (...args: unknown[]) => {
        ops.push({ method, args })
        return builder
      }
    }

    builder.single = () => {
      ops.push({ method: 'single', args: [] })
      return settle('single')
    }
    builder.maybeSingle = () => {
      ops.push({ method: 'maybeSingle', args: [] })
      return settle('maybeSingle')
    }
    // Zincir doğrudan await edildiğinde (terminal metot olmadan) çözülür.
    builder.then = (onFulfilled: unknown, onRejected: unknown) =>
      settle('await').then(onFulfilled as never, onRejected as never)

    return builder
  }

  const client = {
    from: vi.fn((table: string) => createBuilder(table)),
    auth,
    // Şemada RPC yok; çağrılırsa test bilinçli olarak kırılsın.
    rpc: vi.fn(() => {
      throw new Error('Bu projede RPC kullanılmıyor (schema.sql: REVOKE EXECUTE).')
    }),
  }

  return {
    client,
    queries,
    queriesFor: (table: string) => queries.filter((q) => q.table === table),
    onlyQuery: () => {
      if (queries.length !== 1) {
        throw new Error(`Tek sorgu bekleniyordu, ${queries.length} tane bulundu`)
      }
      return queries[0]
    },
    auth,
    reset: () => {
      queries.length = 0
    },
  }
}
