import { type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Switch - מתג ON/OFF.
 * גודל מגע: wrapper 44x44px.
 * role="switch" + aria-checked לנגישות.
 * RTL: המתג עצמו ניטרלי לכיוון.
 */
interface SwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: string;
  description?: string;
}

export function Switch({ label, description, className, id, ...props }: SwitchProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-center justify-between gap-3 cursor-pointer",
        "min-h-[44px] py-1",
        className
      )}
    >
      {(label || description) && (
        <div className="flex flex-col gap-0.5">
          {label && (
            <span className="text-sm font-medium text-[var(--color-foreground)]">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-[var(--color-muted-foreground)]">
              {description}
            </span>
          )}
        </div>
      )}

      {/* Track + Thumb */}
      <div className="relative shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="sr-only peer"
          {...props}
        />
        {/* Track */}
        <div
          className={cn(
            "w-11 h-6 rounded-full",
            "bg-[var(--color-muted)] peer-checked:bg-[var(--color-primary)]",
            "transition-colors duration-200",
            "peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--color-ring)] peer-focus-visible:outline-offset-2",
            "peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"
          )}
        />
        {/* Thumb - ב-RTL: מתחיל מימין */}
        <div
          className={cn(
            "absolute top-0.5 start-0.5",
            "w-5 h-5 rounded-full bg-white shadow-sm",
            "transition-transform duration-200",
            // checked: מזיז ל-inline-end (שמאל ב-RTL)
            "peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5"
          )}
        />
      </div>
    </label>
  );
}
