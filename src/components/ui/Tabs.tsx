import {
  createContext,
  useContext,
  useState,
  useId,
  type ReactNode,
  type HTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs components must be used within <Tabs>");
  return ctx;
}

/**
 * Tabs - ניווט כרטיסיות.
 * underline ב-inline-start של הכרטיסייה הפעילה (logical).
 * RTL מטופל ע"י dir="rtl" ב-html.
 */
interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  defaultTab?: string;
  children: ReactNode;
}

export function Tabs({ defaultTab = "", className, children, ...props }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const baseId = useId();

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, baseId }}>
      <div className={cn("flex flex-col gap-0", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex border-b border-[var(--color-border)] overflow-x-auto",
        "scrollbar-none gap-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface TabTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  tabId: string;
  children: ReactNode;
}

export function TabTrigger({ tabId, className, children, ...props }: TabTriggerProps) {
  const { activeTab, setActiveTab, baseId } = useTabsContext();
  const isActive = activeTab === tabId;

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${tabId}`}
      aria-selected={isActive}
      aria-controls={`${baseId}-panel-${tabId}`}
      onClick={() => setActiveTab(tabId)}
      className={cn(
        "relative px-4 min-h-[44px] text-sm font-medium",
        "whitespace-nowrap shrink-0",
        "transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]",
        isActive
          ? "text-[var(--color-primary)]"
          : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
        className
      )}
      {...props}
    >
      {children}
      {/* underline - bottom של הכרטיסייה הפעילה */}
      {isActive && (
        <div
          className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--color-primary)] rounded-t-full"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

interface TabPanelProps extends HTMLAttributes<HTMLDivElement> {
  tabId: string;
  children: ReactNode;
}

export function TabPanel({ tabId, className, children, ...props }: TabPanelProps) {
  const { activeTab, baseId } = useTabsContext();
  const isActive = activeTab === tabId;

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${tabId}`}
      aria-labelledby={`${baseId}-tab-${tabId}`}
      hidden={!isActive}
      className={cn("pt-4", !isActive && "hidden", className)}
      {...props}
    >
      {children}
    </div>
  );
}
