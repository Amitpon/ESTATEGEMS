/** שדה מספרי עם תווית ויחידה. מספרים תמיד LTR גם בתוך ממשק RTL. */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  step = 1,
  hint,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  suffix?: string
  step?: number
  hint?: string
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-[var(--color-foreground)]">{label}</span>
      <span className="mt-1 flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 focus-within:border-[var(--color-ring)] focus-within:ring-2 focus-within:ring-[var(--color-ring)]">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(Number(e.target.value))}
          dir="ltr"
          className="min-h-11 w-full bg-transparent text-start text-base tabular-nums outline-none"
        />
        {suffix ? <span className="shrink-0 text-sm text-[var(--color-muted-foreground)]">{suffix}</span> : null}
      </span>
      {hint ? <span className="mt-1 block text-xs text-[var(--color-muted-foreground)]">{hint}</span> : null}
    </label>
  )
}
