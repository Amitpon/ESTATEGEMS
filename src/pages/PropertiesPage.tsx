import { useEffect, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { Card } from '@/components/ui/Card'
import { analyze, defaultAssumptions } from '@/lib/calc'
import { formatCompactILS, formatILS, formatPercentDirect } from '@/lib/format'
import {
  deleteProperty,
  getCurrentUser,
  isAppwriteConfigured,
  listProperties,
  type AppwriteUser,
  type SavedProperty,
} from '@/services/appwrite'
import type { PropertyAnalysis } from '@/hooks/usePropertyAnalysis'

const EXEMPTION_LABEL = 'כניסת הפטור ממס שבח'

/** ארבעת המדדים שמוצגים בהשוואה - הצעה מ-docs/ROADMAP.md 4.1, פתוחה לשינוי. */
interface Headline {
  readonly netMonthlyCashflow: number
  readonly investedCapital: number
  readonly profitAtExemption: number | null
  readonly averageAnnualReturnPct: number | null
}

/**
 * מחשב את ארבעת המדדים הראשיים לכרטיס/השוואה, ישירות מהמנוע.
 *
 * ההנחות שנשמרו יחד עם הנכס לא נשמרות (saveProperty שומר רק PropertyInput) -
 * לכן משתמשים בהנחות ברירת המחדל. אם המשתמש כיוון הנחות מותאמות בזמן
 * השמירה, ההשוואה כאן לא תשקף אותן. זו מגבלה ידועה, לא באג.
 */
function computeHeadline(saved: SavedProperty): Headline | null {
  try {
    const data = analyze(saved.input, defaultAssumptions())
    const exemptionRow =
      data.saleSchedule.find((r) => r.label === EXEMPTION_LABEL) ??
      data.saleSchedule[data.saleSchedule.length - 1]
    return {
      netMonthlyCashflow: data.metrics.netMonthlyCashflow.value,
      investedCapital: data.equity.investedCapital,
      profitAtExemption: exemptionRow ? exemptionRow.totalProfit : null,
      averageAnnualReturnPct: exemptionRow ? exemptionRow.averageAnnualReturnPct : null,
    }
  } catch {
    // נכס שמור עם קלט שאינו תקין עוד (למשל שדה שהוסר) - לא מפיל את המסך.
    return null
  }
}

export function PropertiesPage({ analysis }: { analysis: PropertyAnalysis }) {
  const [, navigate] = useLocation()
  const [user, setUser] = useState<AppwriteUser | null | 'loading'>('loading')
  const [items, setItems] = useState<readonly SavedProperty[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<readonly string[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!isAppwriteConfigured()) {
      setUser(null)
      return
    }
    getCurrentUser().then(setUser)
  }, [])

  useEffect(() => {
    if (user === 'loading' || user === null) return
    listProperties().then((res) => {
      if (res.ok) setItems(res.data)
      else setError(res.error.message)
    })
  }, [user])

  function toggleSelected(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      // עד 5 נכסים בהשוואה - יותר מזה הופך את הטבלה לבלתי קריאה.
      if (prev.length >= 5) return prev
      return [...prev, id]
    })
  }

  function handleLoad(item: SavedProperty) {
    analysis.loadSavedProperty(item.input, item.id)
    navigate('/')
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const res = await deleteProperty(id)
    setDeletingId(null)
    if (res.ok) {
      setItems((prev) => prev?.filter((x) => x.id !== id) ?? null)
      setSelected((prev) => prev.filter((x) => x !== id))
    }
  }

  if (!isAppwriteConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <BackLink />
        <Card className="p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          שמירת נכסים לא זמינה בסביבה הזו.
        </Card>
      </div>
    )
  }

  if (user === 'loading') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <BackLink />
        <div className="h-24 animate-pulse rounded-2xl bg-[var(--color-muted)]" aria-hidden />
      </div>
    )
  }

  if (user === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <BackLink />
        <Card className="p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          יש להתחבר כדי לראות נכסים שמורים. כפתור ההתחברות נמצא במסך הניתוח.
        </Card>
      </div>
    )
  }

  const selectedItems = items?.filter((x) => selected.includes(x.id)) ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <BackLink />
      <h1 className="text-lg font-bold text-[var(--color-foreground)]">הנכסים השמורים שלי</h1>

      {error && (
        <Card className="border-[var(--color-warning)] bg-[var(--color-warning-bg)] p-4 text-sm text-[var(--color-warning)]">
          {error}
        </Card>
      )}

      {items && items.length === 0 && (
        <Card className="p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          עוד לא שמרת נכס. חזור למסך הניתוח ולחץ "שמור לענן".
        </Card>
      )}

      {selectedItems.length >= 2 && (
        <CompareTable items={selectedItems} />
      )}

      <div className="space-y-3">
        {items?.map((item) => {
          const headline = computeHeadline(item)
          const checked = selected.includes(item.id)
          return (
            <Card key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelected(item.id)}
                    disabled={!checked && selected.length >= 5}
                    className="mt-1"
                    aria-label={`בחר את ${item.label} להשוואה`}
                  />
                  <div>
                    <div className="font-medium text-[var(--color-foreground)]">{item.label}</div>
                    <div className="text-xs text-[var(--color-muted-foreground)]">
                      עודכן{' '}
                      {new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', year: 'numeric' }).format(
                        new Date(item.updatedAt),
                      )}
                    </div>
                  </div>
                </label>
                <div className="flex flex-shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => handleLoad(item)}
                    className="min-h-[36px] rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
                  >
                    פתח לעריכה
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="min-h-[36px] rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-destructive)] hover:bg-[var(--color-destructive-bg)] disabled:opacity-50"
                  >
                    {deletingId === item.id ? 'מוחק...' : 'מחיקה'}
                  </button>
                </div>
              </div>

              {headline && (
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-3 text-xs sm:grid-cols-4">
                  <HeadlineStat label="תזרים חודשי" value={formatILS(headline.netMonthlyCashflow)} />
                  <HeadlineStat label="הון מושקע" value={formatCompactILS(headline.investedCapital)} />
                  <HeadlineStat
                    label="רווח בנקודת הפטור"
                    value={headline.profitAtExemption !== null ? formatCompactILS(headline.profitAtExemption) : '-'}
                  />
                  <HeadlineStat
                    label="תשואה שנתית ממוצעת"
                    value={
                      headline.averageAnnualReturnPct !== null
                        ? formatPercentDirect(headline.averageAnnualReturnPct)
                        : '-'
                    }
                  />
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function BackLink() {
  return (
    <Link
      href="/"
      className="mb-4 inline-flex min-h-[36px] items-center text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
    >
      → חזרה לניתוח
    </Link>
  )
}

function HeadlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[var(--color-muted-foreground)]">{label}</div>
      <div className="tabular-nums font-semibold text-[var(--color-foreground)]">{value}</div>
    </div>
  )
}

function CompareTable({ items }: { items: readonly SavedProperty[] }) {
  const rows = items.map((item) => ({ item, headline: computeHeadline(item) }))
  return (
    <Card className="overflow-x-auto p-4">
      <h2 className="mb-3 text-sm font-semibold text-[var(--color-foreground)]">השוואה</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-start text-xs text-[var(--color-muted-foreground)]">
            <th className="border-e border-[var(--color-border)] pe-3 text-start font-medium">נכס</th>
            <th className="px-3 text-start font-medium">תזרים חודשי</th>
            <th className="px-3 text-start font-medium">הון מושקע</th>
            <th className="px-3 text-start font-medium">רווח בנקודת הפטור</th>
            <th className="ps-3 text-start font-medium">תשואה שנתית ממוצעת</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ item, headline }) => (
            <tr key={item.id} className="border-t border-[var(--color-border)]">
              <td className="border-e border-[var(--color-border)] py-2 pe-3 font-medium text-[var(--color-foreground)]">
                {item.label}
              </td>
              <td className="tabular-nums px-3 py-2">
                {headline ? formatILS(headline.netMonthlyCashflow) : '-'}
              </td>
              <td className="tabular-nums px-3 py-2">
                {headline ? formatCompactILS(headline.investedCapital) : '-'}
              </td>
              <td className="tabular-nums px-3 py-2">
                {headline?.profitAtExemption !== null && headline?.profitAtExemption !== undefined
                  ? formatCompactILS(headline.profitAtExemption)
                  : '-'}
              </td>
              <td className="tabular-nums ps-3 py-2">
                {headline?.averageAnnualReturnPct !== null && headline?.averageAnnualReturnPct !== undefined
                  ? formatPercentDirect(headline.averageAnnualReturnPct)
                  : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
