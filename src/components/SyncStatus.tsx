/**
 * SyncStatus - אינדיקטור סנכרון ענן לנכס הנוכחי.
 *
 * שלושה מצבים:
 *  1. user === null → null (לא מחובר - אין טעם להציג)
 *  2. isSaved === false → "מקומי בלבד" + כפתור "שמור לענן"
 *  3. isSaved === true → "שמור בענן" + תאריך עדכון אחרון
 *
 * Props:
 *  - user: AppwriteUser | null - מגיע מה-parent שכבר שאל getCurrentUser
 *  - isSaved: boolean - האם הנכס הנוכחי שמור בענן
 *  - lastSaved?: Date - מתי שמרנו לאחרונה
 *  - onSave: () => void - callback לשמירה בענן
 *  - isSaving?: boolean - בתהליך שמירה
 *
 * שפה עיצובית: פשוטה ולא צועקת - מיקום משני ליד כפתורי הפעולה.
 */

import type { AppwriteUser } from '@/services/appwrite'

interface Props {
  readonly user: AppwriteUser | null
  readonly isSaved: boolean
  readonly lastSaved?: Date
  readonly onSave: () => void
  readonly isSaving?: boolean
}

export function SyncStatus({ user, isSaved, lastSaved, onSave, isSaving = false }: Props) {
  // לא מחובר - לא מציגים כלום
  if (user === null) return null

  if (isSaved) {
    // שמור בענן - מציגים אינדיקטור ירוק + תאריך
    const dateStr = lastSaved
      ? new Intl.DateTimeFormat('he-IL', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }).format(lastSaved)
      : null

    return (
      <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
        {/* נקודה ירוקה - סנכרון תקין */}
        <span
          className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-[var(--color-positive)]"
          aria-hidden
        />
        <span className="tabular-nums">
          {dateStr ? `שמור בענן - ${dateStr}` : 'שמור בענן'}
        </span>
      </div>
    )
  }

  // לא שמור - כפתור שמירה
  return (
    <button
      type="button"
      onClick={onSave}
      disabled={isSaving}
      className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] transition hover:bg-[var(--color-muted)] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
    >
      {/* ענן + חץ למעלה */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <polyline points="16 16 12 12 8 16" />
        <line x1="12" y1="12" x2="12" y2="21" />
        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
      </svg>
      {isSaving ? 'שומר...' : 'שמור לענן'}
    </button>
  )
}
