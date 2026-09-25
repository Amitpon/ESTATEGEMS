import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Card - מיכל מידע.
 * border קל + shadow קל. לא shadow עמוק - זה כלי נתונים.
 */
const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[var(--radius)] border border-[var(--color-border)]",
        "bg-[var(--color-card)] text-[var(--color-card-foreground)]",
        "shadow-[0_1px_3px_rgba(0,0,0,0.06)]",
        className
      )}
      {...props}
    />
  )
);

/**
 * KpiCard - כרטיס מדד KPI.
 * border-inline-start: 3px sage accent (בהשראת Nexus dashboard).
 * רדיוס גדול יותר (radius-lg) לביזוריות מודגשת.
 * מבנה מומלץ: label קטן muted למעלה -> מספר גדול bold -> context chip.
 */
const KpiCard = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--color-border)]",
        "bg-[var(--color-card)] text-[var(--color-card-foreground)]",
        "shadow-[0_1px_3px_rgba(0,0,0,0.06)]",
        // accent bar בצד ה-start (ימין ב-RTL) - זיהוי מהיר כ-KPI
        "border-s-[3px] border-s-[var(--color-brand-accent)]",
        className
      )}
      {...props}
    />
  )
);
KpiCard.displayName = "KpiCard";
Card.displayName = "Card";

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col gap-1 p-4 pb-0", className)}
      {...props}
    />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-base font-semibold leading-snug text-[var(--color-foreground)]",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "text-sm text-[var(--color-muted-foreground)] leading-snug",
      className
    )}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-4", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center p-4 pt-0", className)}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";

export {
  Card,
  KpiCard,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
};
