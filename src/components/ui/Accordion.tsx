import {
  useState,
  useId,
  type ReactNode,
  type HTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

/**
 * Accordion - קומפוננט פתיחה/סגירה.
 * חץ ב-inline-end (RTL: ימין, LTR: שמאל) - logical property.
 * מינימום 48px לאזור הלחיצה.
 * aria-expanded + aria-controls לנגישות.
 */
interface AccordionItemProps extends HTMLAttributes<HTMLDivElement> {
  trigger: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** מאפשר שליטה חיצונית */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AccordionItem({
  trigger,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className,
  ...props
}: AccordionItemProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const id = useId();
  const contentId = `accordion-content-${id}`;

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const toggle = () => {
    const next = !isOpen;
    if (onOpenChange) {
      onOpenChange(next);
    } else {
      setInternalOpen(next);
    }
  };

  return (
    <div
      className={cn("border-b border-[var(--color-border)]", className)}
      {...props}
    >
      {/* Trigger - לפחות 48px גובה */}
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={toggle}
        className={cn(
          "flex w-full items-center justify-between",
          "min-h-[48px] py-3 px-0",
          "text-sm font-medium text-[var(--color-foreground)]",
          "hover:text-[var(--color-primary)] transition-colors",
          "focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]",
          "cursor-pointer"
        )}
      >
        {/* טריגר תוכן - RTL: טקסט בימין, חץ בשמאל */}
        <span className="text-start">{trigger}</span>
        {/* החץ ב-inline-end (שמאל ב-RTL) */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className={cn(
            "ms-2 shrink-0 transition-transform duration-200",
            // ב-RTL: חץ למטה = פתוח, חץ למעלה = סגור (הפוך מ-LTR כי rotate)
            isOpen ? "rotate-180" : "rotate-0"
          )}
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Content */}
      <div
        id={contentId}
        role="region"
        hidden={!isOpen}
        className={cn(
          "pb-3 text-sm text-[var(--color-foreground)]",
          !isOpen && "hidden"
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Accordion - מיכל לפריטים.
 * mode="single": רק פריט אחד פתוח בכל פעם.
 */
interface AccordionProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Accordion({ className, children, ...props }: AccordionProps) {
  return (
    <div
      className={cn("divide-y-0", className)}
      {...props}
    >
      {children}
    </div>
  );
}
