/**
 * src/services/appwrite.ts
 *
 * שכבת auth ושמירת נכסים בענן דרך Appwrite Cloud.
 *
 * עיקרון מרכזי מהתוכנית (שלב ב3): הכלי לא נחסם מאחורי התחברות. מי שלא
 * מחובר ממשיך לחשב מקומית - כל פונקציה כאן היא תוספת, לא שער.
 *
 * `appwrite` (~33kB gzip) נטען דינמית ורק כשהמשתמש בפועל פותח את מסך
 * ההתחברות או לוחץ "שמור לענן" - `sideEffects: "None"` (מחרוזת, לא בוליאני)
 * ב-package.json שלהם כנראה שובר tree-shaking, אז מניחים שזה המחיר המלא
 * וטוענים רק על-פי דרישה.
 *
 * הרשאות: כל שורה בטבלה נשמרת עם $permissions שמגבילות קריאה/כתיבה
 * לבעלים בלבד (Permission.read/update/delete עם Role.user(userId)), כדי
 * שמשתמש א' לא יוכל לקרוא נתונים של ב' גם אם הרשאות הטבלה מוגדרות רחב יותר.
 */

import type { PropertyInput } from '@/types/property'

// ---------------------------------------------------------------------------
// Config - חסר = Appwrite כבוי, לא שגיאה
// ---------------------------------------------------------------------------

interface AppwriteConfig {
  readonly endpoint: string
  readonly projectId: string
  readonly databaseId: string
  readonly propertiesCollectionId: string
}

function readConfig(): AppwriteConfig | null {
  const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT
  const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID
  const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID
  const propertiesCollectionId = import.meta.env.VITE_APPWRITE_PROPERTIES_COLLECTION_ID
  if (!endpoint || !projectId || !databaseId || !propertiesCollectionId) return null
  return { endpoint, projectId, databaseId, propertiesCollectionId }
}

/** true אם כל משתני הסביבה קיימים. הממשק חייב להסתיר לגמרי את ה-UI של auth אם false. */
export function isAppwriteConfigured(): boolean {
  return readConfig() !== null
}

// ---------------------------------------------------------------------------
// Client - טעינה דינמית, singleton יחיד לכל טעינת דף
// ---------------------------------------------------------------------------

type AppwriteModule = typeof import('appwrite')

let modulePromise: Promise<AppwriteModule> | null = null
function loadModule(): Promise<AppwriteModule> {
  if (!modulePromise) modulePromise = import('appwrite')
  return modulePromise
}

interface Sdk {
  readonly account: import('appwrite').Account
  readonly tablesDB: import('appwrite').TablesDB
  readonly mod: AppwriteModule
}

let sdkPromise: Promise<Sdk> | null = null

/**
 * זורק אם Appwrite לא מוגדר - כל קריאה ציבורית בקובץ הזה בודקת isAppwriteConfigured קודם.
 *
 * הפרויקט נוצר עם ה-Tables feature החדש של Appwrite (קונסולה מציגה
 * "Table"/"Rows"/"Columns" ולא "Collection"/"Documents"/"Attributes") - לכן
 * `TablesDB`, לא `Databases`. שני ה-API-ים קיימים ב-SDK אבל מדברים לנתיבי
 * שרת שונים (`/tablesdb/...` מול `/databases/...`) ולא ניתנים להחלפה.
 */
function getSdk(): Promise<Sdk> {
  if (sdkPromise) return sdkPromise
  const config = readConfig()
  if (!config) throw new Error('Appwrite אינו מוגדר - חסרים משתני סביבה VITE_APPWRITE_*')

  sdkPromise = loadModule().then((mod) => {
    const client = new mod.Client().setEndpoint(config.endpoint).setProject(config.projectId)
    return { account: new mod.Account(client), tablesDB: new mod.TablesDB(client), mod }
  })
  return sdkPromise
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AppwriteUser {
  readonly id: string
  readonly email: string
  readonly name: string
}

/** null אם אין session פעיל - זו לא שגיאה, זה מצב "לא מחובר". */
export async function getCurrentUser(): Promise<AppwriteUser | null> {
  if (!isAppwriteConfigured()) return null
  try {
    const { account } = await getSdk()
    const u = await account.get()
    return { id: u.$id, email: u.email, name: u.name }
  } catch {
    return null
  }
}

/**
 * redirect ל-Google OAuth. לא מחזיר משתמש - אחרי ההפניה חזרה, getCurrentUser
 * הוא שקורא את ה-session. success/failure URLs הם הדף הנוכחי בשני המקרים,
 * כדי לא לתחזק דף /oauth נפרד.
 */
export async function loginWithGoogle(): Promise<void> {
  const { account, mod } = await getSdk()
  const url = window.location.origin + window.location.pathname
  account.createOAuth2Session(mod.OAuthProvider.Google, url, url)
}

export async function loginWithEmail(email: string, password: string): Promise<AppwriteUser> {
  const { account } = await getSdk()
  await account.createEmailPasswordSession(email, password)
  const u = await account.get()
  return { id: u.$id, email: u.email, name: u.name }
}

export async function registerWithEmail(
  email: string,
  password: string,
  name: string,
): Promise<AppwriteUser> {
  const { account, mod } = await getSdk()
  await account.create(mod.ID.unique(), email, password, name)
  await account.createEmailPasswordSession(email, password)
  const u = await account.get()
  return { id: u.$id, email: u.email, name: u.name }
}

export async function logout(): Promise<void> {
  const { account } = await getSdk()
  await account.deleteSession('current')
}

// ---------------------------------------------------------------------------
// Properties CRUD - collection אחת, מסמך אחד לכל נכס שמור
// ---------------------------------------------------------------------------

export interface SavedProperty {
  readonly id: string
  readonly label: string
  readonly input: PropertyInput
  readonly updatedAt: string
}

export type AppwriteError = { readonly code: 'NOT_CONFIGURED' | 'UNAUTHORIZED' | 'NETWORK'; readonly message: string }
export type AppwriteResult<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: AppwriteError }

function toError(err: unknown): AppwriteError {
  const message = err instanceof Error ? err.message : 'שגיאת תקשורת מול השרת'
  return { code: 'NETWORK', message }
}

/** שומר נכס חדש או מעדכן קיים. permissions ברמת המסמך מגבילות לבעלים בלבד. */
export async function saveProperty(
  userId: string,
  label: string,
  input: PropertyInput,
  existingId?: string,
): Promise<AppwriteResult<SavedProperty>> {
  const config = readConfig()
  if (!config) return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Appwrite אינו מוגדר' } }

  try {
    const { tablesDB, mod } = await getSdk()
    const permissions = [
      mod.Permission.read(mod.Role.user(userId)),
      mod.Permission.update(mod.Role.user(userId)),
      mod.Permission.delete(mod.Role.user(userId)),
    ]
    const data = { label, input: JSON.stringify(input) }
    const row = existingId
      ? await tablesDB.updateRow(config.databaseId, config.propertiesCollectionId, existingId, data)
      : await tablesDB.createRow(
          config.databaseId,
          config.propertiesCollectionId,
          mod.ID.unique(),
          data,
          permissions,
        )
    return {
      ok: true,
      data: {
        id: row.$id,
        label: row['label'] as string,
        input: JSON.parse(row['input'] as string) as PropertyInput,
        updatedAt: row.$updatedAt,
      },
    }
  } catch (err) {
    return { ok: false, error: toError(err) }
  }
}

export async function listProperties(): Promise<AppwriteResult<readonly SavedProperty[]>> {
  const config = readConfig()
  if (!config) return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Appwrite אינו מוגדר' } }

  try {
    const { tablesDB } = await getSdk()
    // ללא queries - permissions ברמת שורה כבר מסננות רק את השורות של המשתמש המחובר.
    const res = await tablesDB.listRows(config.databaseId, config.propertiesCollectionId)
    const items = res.rows.map((row) => ({
      id: row.$id,
      label: row['label'] as string,
      input: JSON.parse(row['input'] as string) as PropertyInput,
      updatedAt: row.$updatedAt,
    }))
    return { ok: true, data: items }
  } catch (err) {
    return { ok: false, error: toError(err) }
  }
}

export async function deleteProperty(id: string): Promise<AppwriteResult<void>> {
  const config = readConfig()
  if (!config) return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Appwrite אינו מוגדר' } }

  try {
    const { tablesDB } = await getSdk()
    await tablesDB.deleteRow(config.databaseId, config.propertiesCollectionId, id)
    return { ok: true, data: undefined }
  } catch (err) {
    return { ok: false, error: toError(err) }
  }
}
