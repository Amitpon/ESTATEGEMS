/**
 * טסטים ל-src/services/appwrite.ts.
 *
 * זהו קוד auth - לפי CLAUDE.md הגלובלי חובה טסטים לפני/עם השינוי, לא אחריו.
 * שני דברים קריטיים לבדוק מעבר ל-happy path:
 *  1. בלי משתני VITE_APPWRITE_* - הכל חוזר "לא מוגדר" בלי לזרוק, כי הכלי
 *     לא נחסם מאחורי Appwrite (עיקרון "לא שער" מהתוכנית).
 *  2. saveProperty שולחת $permissions מוגבלות ל-Role.user(userId) של הבעלים
 *     בלבד - לא Role.any() - אחרת משתמש א' יכול לקרוא נתונים של ב'.
 *
 * ה-SDK של appwrite מדומה (vi.mock) - אין קריאות רשת אמיתיות.
 * vi.resetModules() בכל טסט כדי לאפס את ה-singleton של הלקוח בין טסטים.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PropertyInput } from '@/types/property'

const accountMock = {
  get: vi.fn(),
  createEmailPasswordSession: vi.fn(),
  createOAuth2Session: vi.fn(),
  create: vi.fn(),
  deleteSession: vi.fn(),
}
const tablesDBMock = {
  createRow: vi.fn(),
  updateRow: vi.fn(),
  listRows: vi.fn(),
  deleteRow: vi.fn(),
}

vi.mock('appwrite', () => {
  class Client {
    setEndpoint() {
      return this
    }
    setProject() {
      return this
    }
  }
  return {
    Client,
    Account: vi.fn(function Account() {
      return accountMock
    }),
    TablesDB: vi.fn(function TablesDB() {
      return tablesDBMock
    }),
    ID: { unique: () => 'generated-id' },
    Permission: {
      read: (role: string) => `read(${role})`,
      update: (role: string) => `update(${role})`,
      delete: (role: string) => `delete(${role})`,
    },
    Role: { user: (id: string) => `user:${id}` },
    OAuthProvider: { Google: 'google' },
  }
})

function baseInput(): PropertyInput {
  const price = 2_000_000
  return {
    analysisDate: '2026-01-01',
    property: { price, sizeSqm: 80, city: 'תל אביב', kind: 'apartment', rooms: 3 },
    financing: { downPayment: price, tracks: [], earlyRepaymentFeePct: 0 },
    income: { monthlyRent: 5_000, vacancyPct: 8.33 },
    expenses: {
      buildingFee: { kind: 'monthlyAmount', amount: 0 },
      propertyTax: { kind: 'monthlyAmount', amount: 0 },
      insurance: { kind: 'monthlyAmount', amount: 0 },
      maintenance: { kind: 'monthlyAmount', amount: 0 },
      management: { kind: 'monthlyAmount', amount: 0 },
      custom: [],
    },
    acquisitionCosts: {
      brokerFee: 0,
      lawyerFee: 0,
      mortgageAdvisorFee: 0,
      finishingCostPerSqm: 0,
      liquidityReserve: 0,
      custom: [],
    },
    tax: { isSingleApartment: true, rentalTaxTrack: 'exempt', marginalTaxRatePct: 31 },
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
  Object.values(accountMock).forEach((fn) => fn.mockReset())
  Object.values(tablesDBMock).forEach((fn) => fn.mockReset())
})

afterEach(() => {
  vi.unstubAllEnvs()
})

/**
 * מדמה "לא מוגדר" בזדון - יש `.env` אמיתי בפיתוח עם ערכי Appwrite אמיתיים,
 * ו-`vi.unstubAllEnvs()` מחזיר לערכים הטעונים מהקובץ, לא ל-undefined.
 * חובה לדרוס אותם במפורש לריק כדי לבדוק את מצב "לא מחובר".
 */
function stubUnconfigured() {
  vi.stubEnv('VITE_APPWRITE_ENDPOINT', '')
  vi.stubEnv('VITE_APPWRITE_PROJECT_ID', '')
  vi.stubEnv('VITE_APPWRITE_DATABASE_ID', '')
  vi.stubEnv('VITE_APPWRITE_PROPERTIES_COLLECTION_ID', '')
}

describe('appwrite - לא מוגדר (אין משתני סביבה)', () => {
  beforeEach(() => {
    stubUnconfigured()
  })

  it('isAppwriteConfigured מחזיר false', async () => {
    const { isAppwriteConfigured } = await import('../appwrite')
    expect(isAppwriteConfigured()).toBe(false)
  })

  it('getCurrentUser מחזיר null בלי לזרוק - הכלי לא נחסם', async () => {
    const { getCurrentUser } = await import('../appwrite')
    await expect(getCurrentUser()).resolves.toBeNull()
  })

  it('saveProperty מחזיר NOT_CONFIGURED במקום לזרוק', async () => {
    const { saveProperty } = await import('../appwrite')
    const res = await saveProperty('user-1', 'הדירה שלי', baseInput())
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('NOT_CONFIGURED')
  })
})

function stubConfigured() {
  vi.stubEnv('VITE_APPWRITE_ENDPOINT', 'https://cloud.appwrite.io/v1')
  vi.stubEnv('VITE_APPWRITE_PROJECT_ID', 'proj-1')
  vi.stubEnv('VITE_APPWRITE_DATABASE_ID', 'db-1')
  vi.stubEnv('VITE_APPWRITE_PROPERTIES_COLLECTION_ID', 'col-1')
}

describe('appwrite - מוגדר', () => {
  it('isAppwriteConfigured מחזיר true כשכל משתני הסביבה קיימים', async () => {
    stubConfigured()
    const { isAppwriteConfigured } = await import('../appwrite')
    expect(isAppwriteConfigured()).toBe(true)
  })

  it('getCurrentUser ממפה את המשתמש מה-SDK', async () => {
    stubConfigured()
    accountMock.get.mockResolvedValue({ $id: 'u1', email: 'a@b.com', name: 'עמית' })
    const { getCurrentUser } = await import('../appwrite')
    await expect(getCurrentUser()).resolves.toEqual({ id: 'u1', email: 'a@b.com', name: 'עמית' })
  })

  it('getCurrentUser מחזיר null אם אין session פעיל (get זורק)', async () => {
    stubConfigured()
    accountMock.get.mockRejectedValue(new Error('no session'))
    const { getCurrentUser } = await import('../appwrite')
    await expect(getCurrentUser()).resolves.toBeNull()
  })

  it('loginWithEmail יוצר session ואז מחזיר את המשתמש', async () => {
    stubConfigured()
    accountMock.createEmailPasswordSession.mockResolvedValue({})
    accountMock.get.mockResolvedValue({ $id: 'u2', email: 'x@y.com', name: 'דנה' })
    const { loginWithEmail } = await import('../appwrite')
    const user = await loginWithEmail('x@y.com', 'secret123')
    expect(accountMock.createEmailPasswordSession).toHaveBeenCalledWith('x@y.com', 'secret123')
    expect(user).toEqual({ id: 'u2', email: 'x@y.com', name: 'דנה' })
  })

  it('registerWithEmail יוצרת משתמש חדש ואז session', async () => {
    stubConfigured()
    accountMock.create.mockResolvedValue({})
    accountMock.createEmailPasswordSession.mockResolvedValue({})
    accountMock.get.mockResolvedValue({ $id: 'u3', email: 'new@y.com', name: 'רון' })
    const { registerWithEmail } = await import('../appwrite')
    await registerWithEmail('new@y.com', 'secret123', 'רון')
    expect(accountMock.create).toHaveBeenCalledWith('generated-id', 'new@y.com', 'secret123', 'רון')
    expect(accountMock.createEmailPasswordSession).toHaveBeenCalledWith('new@y.com', 'secret123')
  })

  it('logout מוחקת את ה-session הנוכחי', async () => {
    stubConfigured()
    accountMock.deleteSession.mockResolvedValue({})
    const { logout } = await import('../appwrite')
    await logout()
    expect(accountMock.deleteSession).toHaveBeenCalledWith('current')
  })

  it('loginWithGoogle מפנה ל-OAuth עם provider google', async () => {
    stubConfigured()
    const { loginWithGoogle } = await import('../appwrite')
    await loginWithGoogle()
    expect(accountMock.createOAuth2Session).toHaveBeenCalledWith(
      'google',
      expect.any(String),
      expect.any(String),
    )
  })

  describe('saveProperty - הרשאות מסמך', () => {
    it('מגבילה קריאה/עדכון/מחיקה ל-Role.user(userId) של הבעלים בלבד, לא Role.any()', async () => {
      stubConfigured()
      tablesDBMock.createRow.mockResolvedValue({
        $id: 'row1',
        $updatedAt: '2026-09-23T00:00:00.000Z',
        label: 'הדירה שלי',
        input: JSON.stringify(baseInput()),
      })
      const { saveProperty } = await import('../appwrite')
      const res = await saveProperty('owner-1', 'הדירה שלי', baseInput())

      expect(res.ok).toBe(true)
      const permissions = tablesDBMock.createRow.mock.calls[0]?.[4] as string[]
      expect(permissions).toEqual([
        'read(user:owner-1)',
        'update(user:owner-1)',
        'delete(user:owner-1)',
      ])
      expect(permissions.every((p) => !p.includes('any('))).toBe(true)
    })

    it('עם existingId קוראת ל-updateRow במקום ליצור שורה חדשה', async () => {
      stubConfigured()
      tablesDBMock.updateRow.mockResolvedValue({
        $id: 'row1',
        $updatedAt: '2026-09-23T00:00:00.000Z',
        label: 'עודכן',
        input: JSON.stringify(baseInput()),
      })
      const { saveProperty } = await import('../appwrite')
      const res = await saveProperty('owner-1', 'עודכן', baseInput(), 'row1')

      expect(res.ok).toBe(true)
      expect(tablesDBMock.updateRow).toHaveBeenCalledWith(
        'db-1',
        'col-1',
        'row1',
        expect.objectContaining({ label: 'עודכן' }),
      )
      expect(tablesDBMock.createRow).not.toHaveBeenCalled()
    })

    it('כשל רשת חוזר כ-Result שגוי, לא נזרק', async () => {
      stubConfigured()
      tablesDBMock.createRow.mockRejectedValue(new Error('network down'))
      const { saveProperty } = await import('../appwrite')
      const res = await saveProperty('owner-1', 'x', baseInput())
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error.message).toBe('network down')
    })
  })

  it('listProperties ממפה ומפענחת את שדה input מכל שורה', async () => {
    stubConfigured()
    const input = baseInput()
    tablesDBMock.listRows.mockResolvedValue({
      rows: [
        { $id: 'd1', $updatedAt: '2026-09-23T00:00:00.000Z', label: 'א', input: JSON.stringify(input) },
        { $id: 'd2', $updatedAt: '2026-09-22T00:00:00.000Z', label: 'ב', input: JSON.stringify(input) },
      ],
    })
    const { listProperties } = await import('../appwrite')
    const res = await listProperties()
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data).toHaveLength(2)
      expect(res.data[0]).toEqual({ id: 'd1', label: 'א', input, updatedAt: '2026-09-23T00:00:00.000Z' })
    }
  })

  it('deleteProperty קוראת ל-deleteRow עם ה-id הנכון', async () => {
    stubConfigured()
    tablesDBMock.deleteRow.mockResolvedValue({})
    const { deleteProperty } = await import('../appwrite')
    const res = await deleteProperty('row-9')
    expect(res.ok).toBe(true)
    expect(tablesDBMock.deleteRow).toHaveBeenCalledWith('db-1', 'col-1', 'row-9')
  })
})
