import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Input - שדה טקסט בסיסי.
 * גובה 48px לדרישת מגע.
 * text-align: end כברירת מחדל לעברית (RTL).
 * tabular-nums למספרים - הורה לתאר עם data-numeric.
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** האם זה שדה מספר שצריך tabular-nums */
  numeric?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, numeric, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-numeric={numeric || undefined}
        className={cn(
          "flex w-full min-h-[48px] px-3 py-2",
          "rounded-[var(--radius-sm)] border border-[var(--color-input)]",
          "bg-[var(--color-card)] text-[var(--color-foreground)]",
          "text-base placeholder:text-[var(--color-muted-foreground)]",
          // מספרים - LTR בתוך RTL (unicode bidi מטפל נכון, אבל מספרים עם ₪ נזקקים ל-ltr)
          numeric ? "text-start [direction:ltr] tabular-nums" : "text-end",
          "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--color-ring)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-colors duration-150",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
