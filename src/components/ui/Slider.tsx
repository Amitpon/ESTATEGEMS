import { type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Slider - range input מעוצב.
 * RTL: fill מימין לשמאל (direction: rtl על input).
 * גובה מינימלי 44px לאזור מגע.
 */
interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  valueDisplay?: string;
  min: number;
  max: number;
  step?: number;
}

export function Slider({
  label,
  valueDisplay,
  className,
  id,
  min,
  max,
  step = 1,
  value,
  ...props
}: SliderProps) {
  // חישוב אחוז למילוי הרקע
  const numValue = Number(value ?? min);
  const percent = ((numValue - min) / (max - min)) * 100;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {(label || valueDisplay) && (
        <div className="flex items-center justify-between">
          {label && (
            <label
              htmlFor={id}
              className="text-sm font-medium text-[var(--color-foreground)]"
            >
              {label}
            </label>
          )}
          {valueDisplay && (
            <span className="text-sm tabular-nums text-[var(--color-primary)] font-semibold">
              {valueDisplay}
            </span>
          )}
        </div>
      )}

      {/* wrapper עם גובה מגע */}
      <div className="relative flex items-center min-h-[44px]">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          // RTL: ב-range input הכיוון הפוך
          dir="rtl"
          className={cn(
            "w-full h-2 rounded-full appearance-none cursor-pointer",
            "bg-[var(--color-border)]",
            // track fill - CSS custom property trick
            "focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]",
            "[&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5",
            "[&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:bg-[var(--color-primary)]",
            "[&::-webkit-slider-thumb]:shadow-sm",
            "[&::-webkit-slider-thumb]:cursor-pointer"
          )}
          style={{
            // fill מימין ב-RTL
            background: `linear-gradient(to left, var(--color-primary) ${percent}%, var(--color-border) ${percent}%)`,
          }}
          {...props}
        />
      </div>
    </div>
  );
}
