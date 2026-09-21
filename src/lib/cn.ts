import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * מיזוג class names עם Tailwind deduplication.
 * שימוש: cn("px-4 py-2", isActive && "bg-primary", className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
