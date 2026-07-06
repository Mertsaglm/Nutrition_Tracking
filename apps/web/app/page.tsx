import Link from 'next/link'
import { Sparkles, Target, LineChart, UtensilsCrossed, ArrowRight } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

const FEATURES = [
  {
    icon: Target,
    title: 'Kişiselleştirilmiş plan',
    desc: 'Yaş, kilo, hedef ve aktivite seviyene göre bilimsel formüllerle kalori ve makro hedefleri.',
  },
  {
    icon: Sparkles,
    title: 'AI besin analizi',
    desc: '“2 yumurta, 1 dilim ekmek” yaz — AI besin değerlerini saniyeler içinde hesaplasın.',
  },
  {
    icon: LineChart,
    title: 'İlerleme takibi',
    desc: 'Günlük kalori/makro ilerlemeni, kilo değişimini ve serini tek ekranda gör.',
  },
]

const STEPS = [
  { n: 1, title: 'Kayıt ol', desc: 'Ücretsiz hesap oluştur' },
  { n: 2, title: 'Bilgilerini gir', desc: 'Fiziksel özellikler ve hedefler' },
  { n: 3, title: 'Planını al', desc: 'AI destekli kişisel plan' },
  { n: 4, title: 'Takip et', desc: 'Öğünlerini kaydet, ilerle' },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/auth/login" className="btn-ghost">
            Giriş Yap
          </Link>
          <Link href="/auth/signup" className="btn-primary">
            Ücretsiz Başla
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
          <Sparkles className="h-4 w-4" /> Google Gemini destekli
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-neutral-900 md:text-6xl">
          Sağlıklı yaşam <span className="text-brand-600">senin kontrolünde</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-neutral-500">
          Kişiselleştirilmiş beslenme planı, doğal dilde öğün takibi ve ilerleme raporlarıyla
          hedeflerine ulaş.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/auth/signup" className="btn-primary px-6 py-3.5 text-base">
            Ücretsiz Başla <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/auth/login" className="btn-secondary px-6 py-3.5 text-base">
            Giriş Yap
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-6 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card card-hover p-7">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="card p-8 md:p-12">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-neutral-900 md:text-3xl">Nasıl çalışır?</h2>
            <p className="mt-2 text-neutral-500">Dört adımda başla</p>
          </div>
          <div className="grid gap-8 md:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-xl font-bold text-white">
                  {s.n}
                </div>
                <h4 className="font-semibold text-neutral-900">{s.title}</h4>
                <p className="mt-1 text-sm text-neutral-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-neutral-500 md:flex-row">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4" /> Beslenme Takip
          </div>
          <p>AI destekli beslenme asistanı</p>
        </div>
      </footer>
    </main>
  )
}
