import { useEffect, useRef, useState } from "react";

/**
 * Editor text that survives a refresh, saved in localStorage under `padhlo:draft:<key>`.
 * Local only and never trusted by the server: graded runs are re-checked server-side later.
 */
export function useDraft(key: string, initial: string) {
  const storageKey = `padhlo:draft:${key}`;
  const [value, setValue] = useState(initial);
  const loaded = useRef(false);

  // Load after mount, so the server render and first client render match.
  useEffect(() => {
    loaded.current = false;
    try {
      const saved = window.localStorage.getItem(storageKey);
      setValue(saved ?? initial);
    } catch {
      setValue(initial);
    }
    loaded.current = true;
  }, [storageKey, initial]);

  // Debounced save. Saving the untouched starter code just clears the draft.
  useEffect(() => {
    if (!loaded.current) return;
    const id = window.setTimeout(() => {
      try {
        if (value === initial) window.localStorage.removeItem(storageKey);
        else window.localStorage.setItem(storageKey, value.slice(0, 50_000));
      } catch {
        // quota or blocked storage: the draft just isn't kept
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [value, initial, storageKey]);

  return [value, setValue] as const;
}
