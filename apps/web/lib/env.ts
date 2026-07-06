// İstemci tarafı ortam değişkenleri (yalnızca NEXT_PUBLIC_* — public anon key güvenli).
// Gemini anahtarı burada YOK; yalnızca sunucu tarafında (GEMINI_API_KEY).
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Ortam değişkeni eksik: ${name}. .env.local dosyasını kontrol edin.`)
  }
  return value
}

export const ENV = {
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ),
}
