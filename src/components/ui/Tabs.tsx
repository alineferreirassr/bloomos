"use client";

import { createContext, useContext, useId, useState, type KeyboardEvent, type ReactNode } from "react";

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  idPrefix: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error(`<${component}> must be rendered inside <Tabs>`);
  return ctx;
}

interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

/** Controlled when `value` is passed, otherwise manages its own state from `defaultValue` — the same optional-controlled pattern React's own `<input>` uses, so callers who don't need to react to tab changes can skip `value`/`onValueChange` entirely. */
export function Tabs({ value, defaultValue, onValueChange, children, className = "" }: TabsProps) {
  const idPrefix = useId();
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const current = value ?? internalValue;

  function setValue(next: string) {
    if (value === undefined) setInternalValue(next);
    onValueChange?.(next);
  }

  return (
    <TabsContext.Provider value={{ value: current, setValue, idPrefix }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabListProps {
  children: ReactNode;
  "aria-label": string;
  className?: string;
}

/**
 * Roving tabindex per the WAI-ARIA Tabs pattern: only the selected Tab sits
 * in the page's Tab order (see the `tabIndex` logic in `Tab` below); Left/
 * Right/Home/End move focus and selection together (single-select,
 * "automatic activation" tabs — the common case, and the only one needed
 * so far).
 */
export function TabList({ children, className = "", ...rest }: TabListProps) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
    if (tabs.length === 0) return;
    const currentIndex = tabs.indexOf(document.activeElement as HTMLButtonElement);

    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = currentIndex === -1 ? 0 : (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  }

  return (
    <div role="tablist" onKeyDown={onKeyDown} className={`flex gap-1 overflow-x-auto border-b border-border ${className}`} {...rest}>
      {children}
    </div>
  );
}

interface TabProps {
  value: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Tab({ value, children, disabled = false, className = "" }: TabProps) {
  const { value: activeValue, setValue, idPrefix } = useTabsContext("Tab");
  const selected = value === activeValue;

  return (
    <button
      type="button"
      role="tab"
      id={`${idPrefix}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${idPrefix}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      onClick={() => setValue(value)}
      className={`shrink-0 border-b-2 px-3 py-2 font-serif text-[13px] font-semibold whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45 ${
        selected ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-text"
      } ${className}`}
    >
      {children}
    </button>
  );
}

interface TabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
}

/** Unmounts inactive panels rather than hiding them with CSS — simplest way to keep them out of the accessibility tree and tab order with no extra `hidden`/`aria-hidden` bookkeeping. */
export function TabPanel({ value, children, className = "" }: TabPanelProps) {
  const { value: activeValue, idPrefix } = useTabsContext("TabPanel");
  if (value !== activeValue) return null;

  return (
    <div role="tabpanel" id={`${idPrefix}-panel-${value}`} aria-labelledby={`${idPrefix}-tab-${value}`} tabIndex={0} className={className}>
      {children}
    </div>
  );
}
