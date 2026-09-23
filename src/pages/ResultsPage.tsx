import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Disclosure } from '@/components/ui/Disclosure'
import { BreakdownRow } from '@/components/BreakdownRow'
import { ExitPointHero } from '@/components/ExitPointHero'
import { ReportInsights } from '@/components/ReportInsights'
import { CashflowTimeline } from '@/components/CashflowTimeline'
import { AmortizationTable } from '@/components/AmortizationTable'
import { SaleSchedule } from '@/components/SaleSchedule'
import { RateSensitivityTable } from '@/components/RateSensitivityTable'
import { SyncStatus } from '@/components/SyncStatus'
import { findKeyExitPoint } from '@/lib/calc'
import { formatCompactILS, formatILS, formatPercentDirect } from '@/lib/format'
import { printReport } from '@/lib/print'
import { getCurrentUser, isAppwriteConfigured, saveProperty, type AppwriteUser } from '@/services/appwrite'
import type { PropertyAnalysis } from '@/hooks/usePropertyAnalysis'
import type { AssumptionsPanelValues } from '@/components/AssumptionsPanel'

/**
 * שלב התוצאות - היררכיה ויזואלית:
 *
 * שכבה 1 (תמיד גלויה): ExitPointHero - מספרים גדולים, תשואה ותזרים.
 * שכבה 2 (תמיד גלויה): SecondaryMetrics - שלושה מדדים נוספים בגריד.
 * שכבה 3 (מאחורי Disclosure): פירוקי הון, תזרים, רגישות לריבית.
 * שכבה 4 (מאחורי Disclosure): טבלאות ארוכות - לוח סילוקין, ציר תשלומים, מכירה.
 *
 * הגישה מבוססת על thepropertycalculator.co.uk - מספרים ראשיים גדולים,
 * פירוט מאחורי "view breakdown", טבלת רגישות נגישה אך לא בחזית.
 */
export function ResultsPage({
  analysis,
  panel,
}: {
  analysis: PropertyAnalysis
  panel: AssumptionsPanelValues
}) {
  const { result } = analysis

  // שמירה בענן - תוסף אופציונלי, לא שער. משתמש שלא מחובר לא רואה את זה בכלל.
  const [user, setUser] = useState<AppwriteUser | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | undefined>(undefined)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isAppwriteConfigured()) return
    getCurrentUser().then(setUser)
  }, [])

  // נתון חדש (הנחות/קלט השתנו) = חוזר להיות "לא שמור" עד שמירה מחדש.
  useEffect(() => {
    setIsSaved(false)
  }, [result])

  async function handleSaveToCloud() {
    if (!user || !result.ok) return
    setIsSaving(true)
    const label = `${result.input.property.city || 'נכס'} - ${formatCompactILS(result.input.property.price)}`
    const res = await saveProperty(user.id, label, result.input)
    setIsSaving(false)
    if (res.ok) {
      setIsSaved(true)
      setLastSaved(new Date())
    }
  }

  return (
    <div className="space-y-3">
      {/* כפתור הדפסה + סטטוס סנכרון - מוסתרים בהדפסה ממילא */}
      <div data-no-print className="flex items-center justify-between gap-3">
        <SyncStatus
          user={user}
          isSaved={isSaved}
          lastSaved={lastSaved}
          isSaving={isSaving}
          onSave={() => void handleSaveToCloud()}
        />
        <button
          type="button"
          onClick={() => printReport()}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm font-medium text-[var(--color-foreground)] hover:border-[var(--color-ring)] hover:text-[var(--color-primary)] transition-colors"
        >
          הדפסה או שמירה כ-PDF
        </button>
      </div>

      {!result.ok ? (
        <Card className="border-[var(--color-warning)] bg-[var(--color-warning-bg)] p-4 text-sm text-[var(--color-warning)]">
          {result.message}
        </Card>
      ) : (
        <>
          {/* ─── שכבה 1: מדדים ראשיים - גדולים ומיידיים ─── */}
          <ExitPointHero
            monthlyCashflow={result.data.metrics.netMonthlyCashflow.value}
            exit={findKeyExitPoint(result.data.saleSchedule)}
          />

          {/* ─── שכבה 2: מדדים תומכים - גלויים, לא מקופלים ─── */}
          {/*
           * SecondaryMetrics: מחליף את הכרטיס הנפרד לכיסוי ואת ה-details הגולמי
           * לתשואות. כשיש משכנתא: 3 מדדים (כיסוי, ברוטו, על ההון).
           * בלי משכנתא: 2 מדדים בלבד (כיסוי מוסתר, כפי שמצוין במנוע).
           * הם חשובים מספיק להיות גלויים, אך לא ראשיים כמו בExitPointHero.
           */}
          <Card className="p-4">
            {result.data.cashflow.mortgagePayment.monthly > 0 ? (
              /* עם משכנתא: שלושה מדדים בגריד. מפריד ויזואלי דרך border-e. ללא gap כי הריווח
                 מגיע מה-padding סביב הגבול, ולא מ-gap שיצור פער כפול. */
              <div className="grid grid-cols-3">

                {/* כיסוי ההחזר - המדד שמשקיעים שואלים ראשון */}
                <div className="border-e border-[var(--color-border)] pe-3">
                  <div className="text-xs text-[var(--color-muted-foreground)]">כיסוי ההחזר</div>
                  <div
                    dir="ltr"
                    className={`mt-1 text-2xl font-bold tabular-nums leading-none ${
                      result.data.metrics.mortgageCoveragePct.value >= 100
                        ? 'text-[var(--color-positive)]'
                        : 'text-[var(--color-warning)]'
                    }`}
                  >
                    {formatPercentDirect(result.data.metrics.mortgageCoveragePct.value)}
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]">
                    <div
                      className={`h-full rounded-full transition-all ${
                        result.data.metrics.mortgageCoveragePct.value >= 100
                          ? 'bg-[var(--color-positive)]'
                          : 'bg-[var(--color-warning)]'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(0, result.data.metrics.mortgageCoveragePct.value))}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--color-muted-foreground)]">
                    שכ"ד אחרי אי-אכלוס, חלקי ההחזר
                  </p>
                </div>

                {/* תשואה ברוטו */}
                <div className="border-e border-[var(--color-border)] pe-3 ps-3">
                  <div className="text-xs text-[var(--color-muted-foreground)]">תשואה ברוטו</div>
                  <div dir="ltr" className="mt-1 text-2xl font-bold tabular-nums leading-none">
                    {formatPercentDirect(result.data.metrics.grossYieldPct.value)}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-muted-foreground)]">
                    שכ"ד שנתי חלקי מחיר הנכס
                  </p>
                </div>

                {/* תשואה על ההון */}
                <div className="ps-3">
                  <div className="text-xs text-[var(--color-muted-foreground)]">תשואה על ההון</div>
                  <div dir="ltr" className="mt-1 text-2xl font-bold tabular-nums leading-none">
                    {formatPercentDirect(result.data.metrics.cashOnCashPct.value)}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-muted-foreground)]">
                    תזרים שנתי חלקי הון שהושקע
                  </p>
                </div>
              </div>
            ) : (
              /* בלי משכנתא: שני מדדים - כיסוי מוסתר לפי הוראת המנוע */
              <div className="grid grid-cols-2">
                <div className="border-e border-[var(--color-border)] pe-3">
                  <div className="text-xs text-[var(--color-muted-foreground)]">תשואה ברוטו</div>
                  <div dir="ltr" className="mt-1 text-2xl font-bold tabular-nums leading-none">
                    {formatPercentDirect(result.data.metrics.grossYieldPct.value)}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-muted-foreground)]">
                    שכ"ד שנתי חלקי מחיר הנכס
                  </p>
                </div>
                <div className="ps-3">
                  <div className="text-xs text-[var(--color-muted-foreground)]">תשואה על ההון</div>
                  <div dir="ltr" className="mt-1 text-2xl font-bold tabular-nums leading-none">
                    {formatPercentDirect(result.data.metrics.cashOnCashPct.value)}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-muted-foreground)]">
                    תזרים שנתי חלקי הון שהושקע
                  </p>
                </div>
              </div>
            )}

            {/* הסבר - מאחד את הסברי שתי התשואות מהגרסה הישנה */}
            <p className="mt-3 border-t border-[var(--color-border)] pt-2.5 text-[11px] leading-relaxed text-[var(--color-muted-foreground)]">
              שתי התשואות מודדות <strong>שנה אחת</strong> ואינן כוללות רווח
              ממכירה. המספרים בראש המסך הם התמונה המלאה, כולל עליית ערך ומס.
            </p>
          </Card>

          {/* ─── שכבה 3: פירוקים - מאחורי Disclosure ─── */}

          {/*
           * פירוק ההון - "כמה כסף ביום 1".
           * המספר הכולל מוצג בסיכום, כך שאין צורך לפתוח כדי לראות את הסכום.
           * הפירוק עצמו (מרכיב מרכיב) הוא רמת עומק 2.
           */}
          <Disclosure
            title="כמה כסף צריך ביום 1"
            summary={formatCompactILS(result.data.equity.total)}
          >
            <div className="divide-y divide-[var(--color-border)]">
              {result.data.equity.lines.map((line) => (
                <BreakdownRow key={line.key} label={line.label} amount={line.amount} />
              ))}
              <BreakdownRow label="סך הכל" amount={result.data.equity.total} strong />
            </div>
          </Disclosure>

          {/*
           * פירוק התזרים - "מה בא ומה יוצא כל חודש".
           * הסכום הנקי כבר בולט בExitPointHero; כאן הפירוק הוא רמת עומק 2.
           */}
          <Disclosure
            title="פירוק התזרים החודשי"
            summary={
              result.data.cashflow.netCashflow.monthly >= 0
                ? `+${formatILS(result.data.cashflow.netCashflow.monthly)}`
                : formatILS(result.data.cashflow.netCashflow.monthly)
            }
          >
            <div className="divide-y divide-[var(--color-border)]">
              <BreakdownRow label="שכר דירה ברוטו" amount={result.data.cashflow.grossRent.monthly} />
              <BreakdownRow label="אי-אכלוס" amount={-result.data.cashflow.vacancyLoss.monthly} />
              {result.data.cashflow.operatingExpenses.lines.map((line) => (
                <BreakdownRow key={line.key} label={line.label} amount={-line.monthly} />
              ))}
              <BreakdownRow label="החזר משכנתא" amount={-result.data.cashflow.mortgagePayment.monthly} />
              <BreakdownRow label="מס שכר דירה" amount={-result.data.cashflow.rentalTax.monthly} />
              <BreakdownRow label="נשאר בסוף חודש" amount={result.data.cashflow.netCashflow.monthly} strong />
            </div>
          </Disclosure>

          {/* רגישות לריבית - מאחורי Disclosure, כי זו שאלת "מה אם" ולא מדד עיקרי */}
          <Disclosure
            title="רגישות לשינוי בריבית"
            summary="מה אם הריבית תזוז"
          >
            <RateSensitivityTable input={result.input} assumptions={result.assumptions} />
          </Disclosure>

          {/* ─── שכבה 4: הנחות סצנריו - גלויות, לא קריטיות ─── */}
          {/*
           * הרצת הסצנריו מוצגת גלויה כי היא מייצגת את טווח ההנחות של המשתמש
           * ומזכירה שהמספרים תלויים בהנחה. עיקרון 1: כל מספר עתידי מוצג עם הנחתו.
           */}
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-[var(--color-foreground)]">
              שווי הנכס לפי שלושה תרחישי עליית ערך
            </h2>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              הרצה של ההנחות שהזנת - לא תחזית.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[result.data.scenarios.low, result.data.scenarios.central, result.data.scenarios.high].map((s) => (
                <div key={s.key} className="rounded-xl bg-[var(--color-muted)] p-3">
                  <div className="text-[11px] text-[var(--color-muted-foreground)]">{s.label}</div>
                  <div dir="ltr" className="mt-1 text-sm font-semibold tabular-nums">
                    {formatCompactILS(s.endPropertyValue)}
                  </div>
                  <div dir="ltr" className="mt-0.5 text-[11px] tabular-nums text-[var(--color-muted-foreground)]">
                    {s.assumedGrowthPct}%
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-muted-foreground)]">
              {result.data.scenarios.disclaimer}
            </p>
          </Card>

          {/* תובנות - מסכמות את הממצאים הבולטים מהחישוב */}
          <div className="mt-1">
            <ReportInsights analysis={result.data} />
          </div>

          {/* ─── שכבה 5: טבלאות ארוכות - תמיד מאחורי Disclosure ─── */}

          <Disclosure
            title="מתי משלמים ומה"
            summary={`${result.data.capitalTimeline.outflows.length} תשלומים`}
          >
            <CashflowTimeline
              timeline={result.data.capitalTimeline}
              {...(panel.hasPaymentSchedule && panel.isContractorPurchase && panel.occupancyDate
                ? { occupancyDate: panel.occupancyDate }
                : {})}
            />
          </Disclosure>

          <Disclosure
            title="לוח הסילוקין"
            summary={`${formatCompactILS(result.data.mortgage.totalInterest)} ריבית`}
          >
            <AmortizationTable analysis={result.data} />
          </Disclosure>

          <Disclosure title="רווח בכל נקודת מכירה" defaultOpen>
            <SaleSchedule analysis={result.data} />
          </Disclosure>
        </>
      )}

      <p className="px-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
        הכלי מיועד להמחשה בלבד ואינו מהווה ייעוץ מס, ייעוץ משכנתאות או ייעוץ השקעות. נתוני המיסוי
        נכונים למועד העדכון המצוין לצד כל נתון.
      </p>
    </div>
  )
}
