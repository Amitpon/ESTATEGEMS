import { forwardRef, type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Label - תווית לשדה קלט.
 * תמיד מקושרת לשדה דרך htmlFor.
 */
const Label = forwardRef<
  HTMLLabelElement,
  LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "block text-sm font-medium text-[var(--color-foreground)]",
      "mb-1 leading-none",
      "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className
    )}
    {...props}
  />
));

Label.displayName = "Label";

export { Label };
