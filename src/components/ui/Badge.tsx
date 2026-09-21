import { type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Badge - תווית קטנה לסטטוס.
 * variant=positive/warning/destructive לסמנטיקה של תזרים ותשואה.
 * תמיד כולל צבע + אייקון/תווית טקסטואלית - לא מסתמכים על צבע לבד (colorblind).
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)]",
        primary:
          "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]",
        positive:
          "bg-[var(--color-positive-bg)] text-[var(--color-positive-foreground)]",
        warning:
          "bg-[var(--color-warning-bg)] text-[var(--color-warning-foreground)]",
        destructive:
          "bg-[var(--color-destructive-bg)] text-[var(--color-destructive)]",
        outline:
          "border border-[var(--color-border)] text-[var(--color-foreground)] bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
