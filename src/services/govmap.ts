/**
 * src/services/govmap.ts
 *
 * שכבת שליפה מ-govmap.gov.il - עסקאות נדל"ן של רשות המסים.
 *
 * CORS: ה-API מחזיר Access-Control-Allow-Origin: * כל עוד נשלח header של Origin.
 * אין צורך ב-proxy. אך אין SLA - כישלון מחזיר null/[] בלי להפיל את הממשק.
 *
 * קואורדינטות: ITM (EPSG:2039), לא WGS84. ה-shape שחוזר מ-autocomplete כבר ב-ITM.
 * curl בלי Origin נראה כאילו אין CORS - זה לא נכון. הבדיקה האמיתית היא מהדפדפן.
 *
 * Cache: IndexedDB דרך idb. תוקף 24 שעות - מספיק לסשן עבודה, לא מישן נתוני שוק.
 */

import { openDB, type IDBPDatabase } from 'idb'

// ---------------------------------------------------------------------------
// Raw API types - מה שה-API מחזיר בפועל
// ---------------------------------------------------------------------------

/** תוצאה אחת מ-autocomplete. ה-shape מ-field מ-govmap. */
export interface GovmapAutocompleteResult {
  readonly id: string
  readonly text: string
  readonly type: string
  /** קואורדינטות ITM, למשל "POINT(181000 665000)" */
  readonly shape: string
}

/** נקודה בקואורדינטות ITM. */
export interface ItmPoint {
  readonly x: number
  readonly y: number
}

/** רשומת רחוב/בניין שחוזרת מ-deals-near. */
export interface GovmapDealsNearResult {
  readonly dealscount: number
  readonly settlementNameHeb: string
  readonly streetNameHeb: string
  readonly houseNum: string
  readonly polygon_id: string
  readonly objectid: number
}

/**
 * עסקה בודדת כפי שמחזיר neighborhood-deals.
 * השדות Optional כי ה-API עלול להחזיר חלק מהם ריקים.
 * כל קוד שמשתמש בנתון חייב לטפל ב-undefined.
 */
export interface GovmapRawDeal {
  /** תאריך העסקה, לרוב "DD/MM/YYYY" */
  readonly dealDate?: string
  /** מחיר ב-₪ */
  readonly dealAmount?: number
  /** שטח במ"ר */
  readonly sqmeter?: number
  /** קומה */
  readonly floor?: number
  /** מספר חדרים */
  readonly rooms?: number
  readonly streetNameHeb?: string
  readonly houseNum?: string
  readonly buildYear?: number
  /** סוג העסקה */
  readonly dealType?: string
}

export interface GovmapNeighborhoodDealsResponse {
  readonly deals?: readonly GovmapRawDeal[]
  /** חלק מה-endpoints מחזירים את הרשימה ישירות */
  readonly [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Cache - IndexedDB
// ---------------------------------------------------------------------------

const DB_NAME = 'govmap-cache'
const STORE = 'responses'
const TTL_MS = 24 * 60 * 60 * 1000 // 24 שעות

interface CacheEntry {
  key: string
  data: unknown
  expiresAt: number
}

let _db: IDBPDatabase | null = null

async function getDb(): Promise<IDBPDatabase> {
  if (_db) return _db
  _db = await openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' })
      }
    },
  })
  return _db
}

async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const db = await getDb()
    const entry = (await db.get(STORE, key)) as CacheEntry | undefined
    if (!entry || Date.now() > entry.expiresAt) return null
    return entry.data as T
  } catch {
    // IDB עלולה להיכשל בסביבות מסוימות (private mode ב-Safari). כישלון רך.
    return null
  }
}

async function cacheSet(key: string, data: unknown): Promise<void> {
  try {
    const db = await getDb()
    const entry: CacheEntry = { key, data, expiresAt: Date.now() + TTL_MS }
    await db.put(STORE, entry)
  } catch {
    // cache miss זה בסדר - הנתונים יישלפו שוב
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const BASE = 'https://www.govmap.gov.il/api'
/** User-Agent של דפדפן. נדרש כשקוראים מ-node (scripts), CloudFront מחזיר 403 בלעדיו. */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

/** טיפוסי שגיאות שהכלי מכיר */
export type GovmapError =
  | { code: 'NETWORK'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'SERVER_ERROR'; status: number; message: string }
  | { code: 'PARSE_ERROR'; message: string }

export type GovmapResult<T> = { ok: true; data: T } | { ok: false; error: GovmapError }

async function httpPost<T>(path: string, body: unknown): Promise<GovmapResult<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': UA,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      return {
        ok: false,
        error: { code: 'SERVER_ERROR', status: res.status, message: `HTTP ${res.status}` },
      }
    }
    try {
      const data = (await res.json()) as T
      return { ok: true, data }
    } catch {
      return { ok: false, error: { code: 'PARSE_ERROR', message: 'תשובת JSON לא תקינה' } }
    }
  } catch (e) {
    return {
      ok: false,
      error: { code: 'NETWORK', message: e instanceof Error ? e.message : String(e) },
    }
  }
}

async function httpGet<T>(path: string): Promise<GovmapResult<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'User-Agent': UA },
    })
    if (res.status === 404) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `לא נמצא: ${path}` } }
    }
    if (!res.ok) {
      return {
        ok: false,
        error: { code: 'SERVER_ERROR', status: res.status, message: `HTTP ${res.status}` },
      }
    }
    try {
      const data = (await res.json()) as T
      return { ok: true, data }
    } catch {
      return { ok: false, error: { code: 'PARSE_ERROR', message: 'תשובת JSON לא תקינה' } }
    }
  } catch (e) {
    return {
      ok: false,
      error: { code: 'NETWORK', message: e instanceof Error ? e.message : String(e) },
    }
  }
}

// ---------------------------------------------------------------------------
// ITM parsing
// ---------------------------------------------------------------------------

/**
 * מחלץ קואורדינטות ITM ממחרוזת shape כמו "POINT(181234 665432)".
 * מחזיר null אם הפורמט לא מוכר - האחריות לטפל בזה היא על הקורא.
 */
export function parseItmPoint(shape: string): ItmPoint | null {
  const m = /POINT\s*\(\s*([\d.]+)\s+([\d.]+)\s*\)/i.exec(shape)
  if (!m || !m[1] || !m[2]) return null
  const x = parseFloat(m[1])
  const y = parseFloat(m[2])
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * חיפוש כתובת חופשי. מחזיר עד maxResults תוצאות.
 * נשמר ב-cache כי המשתמש מקליד ומשפר - אין טעם להכות את ה-API על כל תו.
 */
export async function autocomplete(
  text: string,
  maxResults = 10,
): Promise<GovmapResult<readonly GovmapAutocompleteResult[]>> {
  if (!text.trim()) return { ok: true, data: [] }

  const cacheKey = `autocomplete:${text.toLowerCase().trim()}:${maxResults}`
  const cached = await cacheGet<readonly GovmapAutocompleteResult[]>(cacheKey)
  if (cached) return { ok: true, data: cached }

  const result = await httpPost<{ results?: readonly GovmapAutocompleteResult[] }>(
    '/search-service/autocomplete',
    { searchText: text, language: 'he', isAccurate: false, maxResults },
  )

  if (!result.ok) return result

  const data = result.data.results ?? []
  await cacheSet(cacheKey, data)
  return { ok: true, data }
}

/**
 * עסקאות בתחום רדיוס מנקודת ITM.
 * @param itm קואורדינטות ITM (נלקחות מ-autocomplete result.shape)
 * @param radiusMeters רדיוס חיפוש. ברירת מחדל 150מ - מייצג בית/רחוב ספציפי.
 */
export async function dealsNear(
  itm: ItmPoint,
  radiusMeters = 150,
): Promise<GovmapResult<readonly GovmapDealsNearResult[]>> {
  const cacheKey = `deals-near:${itm.x},${itm.y}:${radiusMeters}`
  const cached = await cacheGet<readonly GovmapDealsNearResult[]>(cacheKey)
  if (cached) return { ok: true, data: cached }

  const result = await httpGet<readonly GovmapDealsNearResult[]>(
    `/real-estate/deals/${encodeURIComponent(itm.x)},${encodeURIComponent(itm.y)}/${encodeURIComponent(radiusMeters)}`,
  )

  if (!result.ok) return result

  const data = result.data ?? []
  await cacheSet(cacheKey, data)
  return { ok: true, data }
}

/**
 * כל העסקאות בשכונה/פוליגון לפי polygon_id.
 * @param polygonId  מגיע מ-dealsNear result
 * @param from       תאריך התחלה ISO (אופציונלי)
 * @param to         תאריך סיום ISO (אופציונלי)
 * @param limit      מקסימום עסקאות (0 = ללא הגבלה)
 */
export async function neighborhoodDeals(
  polygonId: string,
  from?: string,
  to?: string,
  limit = 0,
): Promise<GovmapResult<readonly GovmapRawDeal[]>> {
  const cacheKey = `neighborhood:${polygonId}:${from ?? ''}:${to ?? ''}:${limit}`
  const cached = await cacheGet<readonly GovmapRawDeal[]>(cacheKey)
  if (cached) return { ok: true, data: cached }

  const params = new URLSearchParams()
  if (limit > 0) params.set('limit', String(limit))
  if (from) params.set('startDate', from)
  if (to) params.set('endDate', to)
  const qs = params.toString() ? `?${params.toString()}` : ''

  const result = await httpGet<GovmapNeighborhoodDealsResponse | readonly GovmapRawDeal[]>(
    `/real-estate/neighborhood-deals/${encodeURIComponent(polygonId)}${qs}`,
  )

  if (!result.ok) return result

  // ה-API מחזיר לפעמים { deals: [...] } ולפעמים מערך ישירות
  let deals: readonly GovmapRawDeal[]
  if (Array.isArray(result.data)) {
    deals = result.data as readonly GovmapRawDeal[]
  } else {
    const obj = result.data as GovmapNeighborhoodDealsResponse
    deals = (obj.deals ?? []) as readonly GovmapRawDeal[]
  }

  await cacheSet(cacheKey, deals)
  return { ok: true, data: deals }
}
