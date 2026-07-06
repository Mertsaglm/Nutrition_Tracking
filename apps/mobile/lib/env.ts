// Mobil ortam değişkenleri (EXPO_PUBLIC_* istemciye gömülür — anon key güvenli).
// Gemini anahtarı burada YOK; AI çağrıları API_URL üzerinden sunucuya gider.
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Ortam değişkeni eksik: ${name}. .env dosyasını kontrol edin.`)
  }
  return value
}

export const ENV = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  ),
  /** AI route'larını barındıran web API'sinin kök adresi. */
  apiUrl: required('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL),
}
