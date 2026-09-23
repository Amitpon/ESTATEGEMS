import { useEffect, useMemo, useRef, useState } from 'react'
import { autocomplete, dealsNear, neighborhoodDeals, parseItmPoint, type GovmapAutocompleteResult } from '@/services/govmap'
import { cleanDeals } from '@/lib/market/clean'
import { computeMarketInsights, computeMarketPosition, type MarketInsights, type MarketPosition } from '@/lib/market/insights'

/**
 * מחבר כתובת שהמשתמש בוחר לנתוני שוק שכונתיים.
 *
 * זהו **עוגן, לא מילוי אוטומטי** (עיקרון 2) - התוצאה מוצגת למשתמש עם
 * מקור ותאריך, והוא זה שמזין את המחיר בעצמו. שום שדה קלט אינו משתנה
 * מכאן.
 *
 * זרימה: הקלדה -> autocomplete (מקוצר) -> בחירת כתובת -> dealsNear
 * (מוצא את polygon_id של הרחוב) -> neighborhoodDeals -> cleanDeals ->
 * computeMarketInsights. כל שלב יכול להיכשל בעדינות; כישלון מציג
 * "אין נתונים זמינים" ולא שובר את המסך.
 */

export type MarketAnchorStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'insufficient'; dealCount: number; minimum: number }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; insights: MarketInsights; position: MarketPosition | null }

const DEBOUNCE_MS = 350

export function useMarketAnchor(subjectPricePerSqm: number) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<readonly GovmapAutocompleteResult[]>([])
  const [selected, setSelected] = useState<GovmapAutocompleteResult | null>(null)
  const [status, setStatus] = useState<MarketAnchorStatus>({ kind: 'idle' })

  // דור בקשה, כדי שתשובה איטית מהקלדה קודמת לא תדרוס תוצאה חדשה יותר.
  const requestId = useRef(0)

  // השלמת כתובת, בהאטה כדי לא להכות את govmap על כל תו.
  useEffect(() => {
    if (selected || !query.trim()) {
      setSuggestions([])
      return
    }
    const id = ++requestId.current
    const timer = setTimeout(async () => {
      const res = await autocomplete(query)
      if (requestId.current !== id) return // תשובה ישנה - נזרקת
      setSuggestions(res.ok ? res.data : [])
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, selected])

  // בחירת כתובת: שולפים עסקאות, מנקים, ומחשבים תובנות.
  useEffect(() => {
    if (!selected) {
      setStatus({ kind: 'idle' })
      return
    }
    const id = ++requestId.current
    setStatus({ kind: 'loading' })

    void (async () => {
      const itm = parseItmPoint(selected.shape)
      if (!itm) {
        if (requestId.current === id) {
          setStatus({ kind: 'error', message: 'לא ניתן היה לאתר את הכתובת על המפה' })
        }
        return
      }

      const near = await dealsNear(itm, 150)
      if (requestId.current !== id) return
      const nearestPolygon = near.ok ? near.data[0] : undefined
      if (!near.ok || !nearestPolygon) {
        setStatus({ kind: 'error', message: 'אין נתוני עסקאות זמינים לכתובת הזו' })
        return
      }

      // חלון של שנתיים אחורה - עדכני מספיק לשקף שוק נוכחי.
      const ref = new Date()
      ref.setFullYear(ref.getFullYear() - 2)
      const minDate = ref.toISOString().slice(0, 10)

      const raw = await neighborhoodDeals(nearestPolygon.polygon_id, minDate)
      if (requestId.current !== id) return
      if (!raw.ok) {
        setStatus({ kind: 'error', message: 'שליפת עסקאות השכונה נכשלה' })
        return
      }

      const { deals } = cleanDeals(raw.data, { minDate })
      const result = computeMarketInsights(deals)
      if (!result.ok) {
        setStatus({
          kind: 'insufficient',
          dealCount: result.error.dealCount,
          minimum: result.error.minimum,
        })
        return
      }

      const position =
        subjectPricePerSqm > 0 ? computeMarketPosition(subjectPricePerSqm, result.data) : null
      setStatus({ kind: 'ready', insights: result.data, position })
    })()
    // subjectPricePerSqm בכוונה לא ב-deps: שינוי מחיר לא צריך לשלוף
    // מחדש עסקאות מ-govmap, רק לחשב מחדש מיקום. זה קורה ב-useMemo למטה.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  // מיקום הנכס מול השוק מתעדכן מיד כשהמשתמש משנה מחיר, בלי לשלוף שוב.
  const position = useMemo(() => {
    if (status.kind !== 'ready') return null
    if (subjectPricePerSqm <= 0) return null
    return computeMarketPosition(subjectPricePerSqm, status.insights)
  }, [status, subjectPricePerSqm])

  const select = (result: GovmapAutocompleteResult) => {
    setSelected(result)
    setQuery(result.text)
    setSuggestions([])
  }

  const clear = () => {
    setSelected(null)
    setQuery('')
    setSuggestions([])
    setStatus({ kind: 'idle' })
  }

  return {
    query,
    setQuery: (v: string) => {
      setSelected(null)
      setQuery(v)
    },
    suggestions,
    select,
    clear,
    selected,
    status: status.kind === 'ready' ? { ...status, position } : status,
  }
}
