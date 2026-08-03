"use client";

import { useEffect, useState } from "react";

/** Delays reflecting `value` until it stops changing for `delayMs` — used to keep list-view search/filter refetches from firing on every keystroke. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
