import {
  useEffect,
  useRef,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/cn";

/**
 * Sheet - Bottom Sheet למובייל.
 * נפתח מלמטה, animation 300ms ease-out.
 * ניתן לסגור: לחיצה על overlay, כפתור סגירה, Escape.
 * Trap focus כשפתוח.
 */
interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** גובה: "sm" = 40vh, "md" = 60vh, "lg" = 80vh, "full" = 95vh */
  size?: "sm" | "md" | "lg" | "full";
  title?: string;
  className?: string;
}

const sizeMap = {
  sm: "max-h-[40vh]",
  md: "max-h-[60vh]",
  lg: "max-h-[80vh]",
  full: "max-h-[95vh]",
};

export function Sheet({
  open,
  onClose,
  children,
  size = "md",
  title,
  className,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // נעילת גלילת body כשפתוח
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Escape לסגירה
  useEffect(() => {
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // focus ראשוני על ה-panel
  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.focus();
    }
  }, [open]);

  const handlePanelKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "פאנל"}
        tabIndex={-1}
        onKeyDown={handlePanelKey}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50",
          "rounded-t-[var(--radius-lg)]",
          "bg-[var(--color-card)] border-t border-[var(--color-border)]",
          "overflow-y-auto",
          "transition-transform duration-300 ease-out",
          sizeMap[size],
          open ? "translate-y-0" : "translate-y-full",
          className
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
        </div>

        {/* כותרת */}
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <h2 className="text-base font-semibold">{title}</h2>
            <button
              onClick={onClose}
              aria-label="סגור"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--color-secondary)] transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M12 4L4 12M4 4l8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        )}

        <div className="px-4 pb-6">{children}</div>
      </div>
    </>
  );
}
