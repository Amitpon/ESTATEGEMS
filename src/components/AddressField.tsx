import type { useMarketAnchor } from '@/hooks/useMarketAnchor'

/**
 * שדה כתובת עם השלמה אוטומטית מ-govmap. נפרד מ-`NumberField` כי הוא
 * דורש תפריט הצעות - לא מתאים לתבנית "label + input" האחידה.
 */
export function AddressField({ anchor }: { anchor: ReturnType<typeof useMarketAnchor> }) {
  const { query, setQuery, suggestions, select, selected } = anchor

  return (
    <div className="relative">
      <label className="block">
        <span className="block text-sm font-medium text-[var(--color-foreground)]">
          כתובת (אופציונלי)
        </span>
        <span className="mt-1 flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 focus-within:border-[var(--color-ring)] focus-within:ring-2 focus-within:ring-[var(--color-ring)]">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="לדוגמה: דיזנגוף 100 תל אביב"
            className="min-h-11 w-full bg-transparent text-start text-base outline-none"
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-autocomplete="list"
          />
        </span>
      </label>
      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
        משמש רק להצגת עסקאות אמת בשכונה, להשוואה. לא משפיע על שום חישוב.
      </p>

      {!selected && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => select(s)}
                className="block w-full px-3 py-2 text-start text-sm hover:bg-[var(--color-muted)]"
              >
                {s.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
