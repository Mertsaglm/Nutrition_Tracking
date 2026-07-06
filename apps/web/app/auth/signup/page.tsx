'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authService } from '@/lib/services'
import { Logo } from '@/components/ui/Logo'

export default function SignUpPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor')
      return
    }
    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalı')
      return
    }

    setLoading(true)
    try {
      await authService.signUp({ email, password, name })
      router.push('/onboarding')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt olurken bir hata oluştu')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="card p-8">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-neutral-900">Hesap oluştur</h1>
            <p className="mt-1 text-neutral-500">Sağlıklı yaşam yolculuğuna başla</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="label">
                İsim
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="input"
                placeholder="Adın Soyadın"
              />
            </div>

            <div>
              <label htmlFor="email" className="label">
                E-posta
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input"
                placeholder="ornek@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Şifre
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input"
                placeholder="En az 6 karakter"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label">
                Şifre Tekrar
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="input"
                placeholder="Şifreni tekrar gir"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Kayıt yapılıyor…' : 'Kayıt Ol'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500">
            Zaten hesabın var mı?{' '}
            <Link href="/auth/login" className="font-semibold text-brand-600 hover:text-brand-700">
              Giriş Yap
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
