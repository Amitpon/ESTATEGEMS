import { formatILS } from '@/lib/format'

/** שורת פירוק - תווית מימין, סכום משמאל. */
export function BreakdownRow({ label, amount, strong }: { label: string; amount: number; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1.5 ${strong ? 'font-semibold' : ''}`}>
      <span className="text-sm text-[var(--color-muted-foreground)]">{label}</span>
      <span dir="ltr" className="text-sm tabular-nums text-[var(--color-foreground)]">
        {formatILS(amount)}
      </span>
    </div>
  )
}
