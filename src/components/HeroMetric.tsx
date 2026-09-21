import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";

/**
 * HeroMetric - המספר הגדול בראש מסך התוצאות.
 *
 * לפי design-spec.md סעיף 6 + עיקרון 1 (אין ודאות, אין המלצה):
 * - hero number: תזרים חודשי נקי
 * - ספים: >500 = ירוק, 0-500 = ענבר, <0 = אדום
 * - WCAG colorblind: צבע + אייקון + sr-only תיאור
 *
 * עיקרון 3: לחיצה על המספר פותחת שכבה 2 (breakdown).
 */

export type MetricState = "positive" | "warning" | "destructive" | "neutral";

interface HeroMetricProps {
  /** הערך המוצג - מחרוזת מפורמטת (כבר עברה דרך formatILS) */
  value: string;
  /** תווית מעל המספר */
  label: string;
  /** טקסט הסבר קטן מתחת - לפי עיקרון 1: מה מבוסס על */
  context?: string;
  state: MetricState;
  /** callback לפתיחת breakdown (שכבה 2) */
  onBreakdownOpen?: () => void;
  className?: string;
}

const stateConfig: Record<
  MetricState,
  {
    textClass: string;
    bgClass: string;
    Icon: ReactNode;
    srLabel: string;
  }
> = {
  positive: {
    textClass: "text-[var(--color-positive)]",
    bgClass: "bg-[var(--color-positive-bg)]",
    Icon: <TrendingUp size={20} aria-hidden="true" />,
    srLabel: "תזרים חיובי",
  },
  warning: {
    textClass: "text-[var(--color-warning)]",
    bgClass: "bg-[var(--color-warning-bg)]",
    Icon: <AlertTriangle size={20} aria-hidden="true" />,
    srLabel: "תזרים שולי",
  },
  destructive: {
    textClass: "text-[var(--color-destructive)]",
    bgClass: "bg-[var(--color-destructive-bg)]",
    Icon: <TrendingDown size={20} aria-hidden="true" />,
    srLabel: "תזרים שלילי",
  },
  neutral: {
    textClass: "text-[var(--color-foreground)]",
    bgClass: "bg-[var(--color-secondary)]",
    Icon: <Minus size={20} aria-hidden="true" />,
    srLabel: "תזרים מאוזן",
  },
};

/**
 * מחשב state לפי ספי תזרים (עיקרון 7 מהאפיון):
 * >500 = positive, 0-500 = warning, <0 = destructive
 */
export function getCashFlowState(monthlyCashFlow: number): MetricState {
  if (monthlyCashFlow > 500) return "positive";
  if (monthlyCashFlow >= 0) return "warning";
  return "destructive";
}

/**
 * מחשב state לפי ספי תשואה גולמית:
 * >4% = positive, 2-4% = warning, <2% = destructive
 */
export function getYieldState(grossYieldPercent: number): MetricState {
  if (grossYieldPercent > 4) return "positive";
  if (grossYieldPercent >= 2) return "warning";
  return "destructive";
}

export function HeroMetric({
  value,
  label,
  context,
  state,
  onBreakdownOpen,
  className,
}: HeroMetricProps) {
  const config = stateConfig[state];

  return (
    <div className={cn("flex flex-col items-center gap-2 py-6", className)}>
      {/* תווית */}
      <span className="text-sm font-medium text-[var(--color-muted-foreground)]">
        {label}
      </span>

      {/* המספר הגדול - לחיץ לפתיחת breakdown */}
      <button
        type="button"
        onClick={onBreakdownOpen}
        aria-label={`${label}: ${value}. לחץ לפירוט`}
        className={cn(
          "flex items-center gap-2 rounded-[var(--radius)]",
          "px-4 py-3 transition-colors duration-150",
          config.bgClass,
          onBreakdownOpen && "cursor-pointer hover:opacity-90 active:opacity-80",
          !onBreakdownOpen && "cursor-default"
        )}
      >
        {/* אייקון - colorblind support */}
        <span className={cn("flex items-center", config.textClass)}>
          {config.Icon}
        </span>

        {/* המספר - dir=ltr כי מספרים LTR בתוך RTL */}
        <span
          dir="ltr"
          className={cn(
            "text-[2rem] font-bold tabular-nums leading-none",
            // 768px ומעלה: גדול יותר
            "md:text-[2.5rem]",
            config.textClass
          )}
        >
          {value}
        </span>

        {/* sr-only תיאור למצב */}
        <span className="sr-only">{config.srLabel}</span>
      </button>

      {/* context - לפי עיקרון 1: מה מבוסס על */}
      {context && (
        <span className="text-xs text-[var(--color-muted-foreground)] text-center max-w-xs">
          {context}
        </span>
      )}

      {/* hint ללחיצה */}
      {onBreakdownOpen && (
        <span className="text-xs text-[var(--color-primary)] opacity-70">
          לחץ לפירוט
        </span>
      )}
    </div>
  );
}
