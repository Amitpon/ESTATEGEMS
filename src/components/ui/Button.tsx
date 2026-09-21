import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Button - פרימיטיב כפתור.
 * גובה מינימלי 48px לעמידה בדרישת מגע 44px (עם padding אנכי).
 * Logical properties בלבד - אין left/right.
 */
const buttonVariants = cva(
  // base
  [
    "inline-flex items-center justify-center gap-2",
    "rounded-[var(--radius)]",
    "font-semibold text-sm leading-none",
    "min-h-[48px] px-6",
    "transition-colors duration-150",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]",
    "disabled:pointer-events-none disabled:opacity-50",
    "cursor-pointer select-none",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]",
          "hover:opacity-90 active:opacity-80",
        ],
        secondary: [
          "bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)]",
          "hover:bg-[var(--color-muted)] active:opacity-80",
        ],
        outline: [
          "border border-[var(--color-border)] bg-transparent text-[var(--color-foreground)]",
          "hover:bg-[var(--color-secondary)] active:opacity-80",
        ],
        ghost: [
          "bg-transparent text-[var(--color-foreground)]",
          "hover:bg-[var(--color-secondary)] active:opacity-80",
        ],
        destructive: [
          "bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)]",
          "hover:opacity-90 active:opacity-80",
        ],
      },
      size: {
        default: "min-h-[48px] px-6 text-sm",
        sm: "min-h-[40px] px-4 text-xs",
        lg: "min-h-[56px] px-8 text-base",
        icon: "min-h-[44px] min-w-[44px] p-0 px-0",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      fullWidth: false,
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** aria-label חובה לכפתורים עם אייקון בלבד */
  "aria-label"?: string;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
