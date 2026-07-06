import { Leaf } from 'lucide-react'

export function Logo({ withText = true }: { withText?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
        <Leaf className="h-5 w-5" />
      </div>
      {withText && (
        <span className="text-lg font-bold tracking-tight text-neutral-900">Beslenme Takip</span>
      )}
    </div>
  )
}
