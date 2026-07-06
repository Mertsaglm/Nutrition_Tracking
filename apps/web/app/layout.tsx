import type { Metadata } from 'next'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ToastProvider } from '@/components/ui/Toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'Beslenme Takip — AI destekli beslenme asistanı',
  description:
    'Bilimsel formüllerle kişisel kalori ve makro hedefleri, AI ile doğal dilde öğün analizi.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <ErrorBoundary>
          <ToastProvider>{children}</ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
