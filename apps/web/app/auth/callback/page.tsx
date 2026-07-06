'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Status = 'loading' | 'success' | 'error'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    const run = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        if (!accessToken || !refreshToken) {
          setStatus('error')
          return
        }
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (error) throw error
        setStatus('success')
      } catch {
        setStatus('error')
      }
    }
    run()
  }, [])

  // Başarıdan sonra otomatik yönlendirme
  useEffect(() => {
    if (status !== 'success') return
    const timer = setTimeout(() => router.push('/onboarding'), 2500)
    return () => clearTimeout(timer)
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 text-center">
        <div>
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <h2 className="text-lg font-semibold text-neutral-900">E-posta doğrulanıyor…</h2>
          <p className="mt-1 text-neutral-500">Hesabın aktifleştiriliyor.</p>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="card w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
            <CheckCircle2 className="h-9 w-9 text-brand-600" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">E-posta doğrulandı</h1>
          <p className="mt-2 text-neutral-500">Profilini tamamlayarak başlayabilirsin.</p>
          <Link href="/onboarding" className="btn-primary mt-6 w-full">
            Hemen Başla
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-danger/10">
          <XCircle className="h-9 w-9 text-danger" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900">Bir sorun oluştu</h1>
        <p className="mt-2 text-neutral-500">
          Doğrulama sırasında bir hata oluştu. Lütfen tekrar giriş yapmayı dene.
        </p>
        <div className="mt-6 space-y-3">
          <Link href="/auth/login" className="btn-primary w-full">
            Giriş Yap
          </Link>
          <Link href="/auth/signup" className="btn-secondary w-full">
            Yeni Hesap Oluştur
          </Link>
        </div>
      </div>
    </div>
  )
}
