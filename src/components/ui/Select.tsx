import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Select - dropdown נייטיבי מעוצב.
 * chevron ב-inline-end (ימין ב-LTR, שמאל ב-RTL) - logical properties.
 * גובה 48px לדרישת מגע.
 */
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, placeholder, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            "flex w-full min-h-[48px] px-3 py-2 pe-8",
            "rounded-[var(--radius-sm)] border border-[var(--color-input)]",
            "bg-[var(--color-card)] text-[var(--color-foreground)]",
            "text-base appearance-none cursor-pointer",
            "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--color-ring)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "transition-colors duration-150",
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {children}
        </select>

        {/* chevron - ב-inline-end, מצביע למטה */}
        <div className="pointer-events-none absolute inset-y-0 end-3 flex items-center">
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
            className="text-[var(--color-muted-foreground)]"
          >
            <path
              d="M3 5l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    );
  }
);

Select.displayName = "Select";

export { Select };
