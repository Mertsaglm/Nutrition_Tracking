import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Sağlıklı Yaşam <br />
            <span className="text-green-600">Senin Kontrolünde</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Kişiselleştirilmiş beslenme planı, öğün takibi ve ilerleme raporlarıyla hedeflerine ulaş
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="bg-green-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors"
            >
              Ücretsiz Başla
            </Link>
            <Link
              href="/auth/login"
              className="bg-white text-gray-700 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-50 transition-colors border border-gray-300"
            >
              Giriş Yap
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white p-8 rounded-2xl shadow-lg">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Kişiselleştirilmiş Plan</h3>
            <p className="text-gray-600">
              Yaş, kilo, hedef ve aktivite seviyene göre özel beslenme planı
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-lg">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Detaylı Takip</h3>
            <p className="text-gray-600">
              Kalori, protein, karbonhidrat ve yağ alımını günlük takip et
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-lg">
            <div className="text-4xl mb-4">📈</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">İlerleme Raporları</h3>
            <p className="text-gray-600">
              Haftalık ve aylık raporlarla gelişimini gör, motive kal
            </p>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Nasıl Çalışır?</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div>
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-green-600">
                1
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Kayıt Ol</h4>
              <p className="text-sm text-gray-600">Ücretsiz hesap oluştur</p>
            </div>
            <div>
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-green-600">
                2
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Bilgilerini Gir</h4>
              <p className="text-sm text-gray-600">Fiziksel özellikler ve hedefler</p>
            </div>
            <div>
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-green-600">
                3
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Planını Al</h4>
              <p className="text-sm text-gray-600">AI destekli kişisel plan</p>
            </div>
            <div>
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-green-600">
                4
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Takip Et</h4>
              <p className="text-sm text-gray-600">Öğünlerini kaydet, ilerle</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
