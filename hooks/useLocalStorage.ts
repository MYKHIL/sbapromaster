// FIX: The `React` namespace, required for types like `React.Dispatch`, was missing from the import.
import React, { useState, useEffect } from 'react';
import * as LZ from 'lz-string';

type UseLocalStorageOptions = {
  preserveCurrentStateOnKeyChange?: boolean;
  skipHydrationOnKeyChange?: boolean;
};

function useLocalStorage<T,>(
  key: string,
  initialValue: T,
  persistenceEnabled: boolean = true,
  options: UseLocalStorageOptions = {}
): [T, React.Dispatch<React.SetStateAction<T>>] {
  // 1. State to store our value. The logic inside useState runs only once on initial render.
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      if (!item) return initialValue;
      
      // Try decompressing first (new format)
      try {
        const decompressed = LZ.decompress(item);
        return decompressed ? JSON.parse(decompressed) : initialValue;
      } catch (e) {
        // Fallback: try parsing as regular JSON (for old stored values)
        return JSON.parse(item);
      }
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  // 2. useEffect to automatically update localStorage whenever the state changes.
  const lastLocalWriteRef = React.useRef<number>(0);

  useEffect(() => {
    if (!persistenceEnabled) return;

    try {
      if (typeof window !== 'undefined') {
        const jsonString = JSON.stringify(storedValue);
        const compressed = LZ.compress(jsonString);
        // Record timestamp so storage events caused by this write can be ignored.
        lastLocalWriteRef.current = Date.now();
        window.localStorage.setItem(key, compressed);
      }
    } catch (error: any) {
      if (error && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        console.warn(`[useLocalStorage] ⚠️ Storage quota exceeded for key "${key}". Compression enabled but data exceeds limits. Consider archiving old data.`);
      } else {
        console.error(`[useLocalStorage] Error setting key "${key}":`, error);
      }
    }
  }, [key, storedValue, persistenceEnabled]);
  
  // 3. useEffect to re-initialize the internal state if the 'key' prop changes.
  // This is CRITICAL for context switching (e.g. switching schoolId).
  const valuesAreEqual = (a: any, b: any): boolean => {
    if (a === b) return true;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (options.skipHydrationOnKeyChange) {
      return;
    }

    try {
      if (typeof window === 'undefined') return;
      const item = window.localStorage.getItem(key);

      // Allow programmatic flows to force a full reset on key change.
      // DataManagement sets `sba_force_skip_preservation` before switching schoolId
      // so that hooks do NOT preserve the previous in-memory state for the new key.
      const forceSkipPreserve = window.localStorage.getItem('sba_force_skip_preservation') === '1';
      if (forceSkipPreserve) {
        try {
          window.localStorage.removeItem('sba_force_skip_preservation');
        } catch (_) {
          // ignore
        }
      }

      if (!item) {
        if (options.preserveCurrentStateOnKeyChange && !forceSkipPreserve) {
          // Preserve current state if no persisted data exists for the new key.
          // This prevents schoolId-driven key transitions from overwriting
          // freshly-loaded remote data during login/session restore.
          return;
        }
        if (!valuesAreEqual(storedValue, initialValue)) {
          setStoredValue(initialValue);
        }
        return;
      }

      try {
        const decompressed = LZ.decompress(item);
        const parsed = decompressed ? JSON.parse(decompressed) : JSON.parse(item);
        if (!valuesAreEqual(storedValue, parsed)) {
          setStoredValue(parsed);
        }
      } catch (e) {
        const parsed = JSON.parse(item);
        if (!valuesAreEqual(storedValue, parsed)) {
          setStoredValue(parsed);
        }
      }
    } catch (error) {
      console.error(`[useLocalStorage] Error syncing for key "${key}":`, error);
      // Do not override state if this happens during a schoolId transition.
    }
  }, [key, options.skipHydrationOnKeyChange, options.preserveCurrentStateOnKeyChange, initialValue, storedValue]);

  // 4. useEffect to listen for changes to the same localStorage key from other tabs.
  useEffect(() => {
    // Helper to update internal state from a serialized value
    const applyNewValue = (raw: string | null) => {
      if (!raw) {
        try {
          const currentStr = JSON.stringify(storedValue);
          const newStr = JSON.stringify(initialValue);
          if (currentStr !== newStr) setStoredValue(initialValue);
        } catch (_) {
          setStoredValue(initialValue);
        }
        return;
      }
      try {
        const decompressed = LZ.decompress(raw);
        const parsed = decompressed ? JSON.parse(decompressed) : JSON.parse(raw);
        try {
          const currentStr = JSON.stringify(storedValue);
          const newStr = JSON.stringify(parsed);
          if (currentStr !== newStr) setStoredValue(parsed);
        } catch (_) {
          setStoredValue(parsed);
        }
      } catch (err) {
        try {
          const parsed = JSON.parse(raw);
          try {
            const currentStr = JSON.stringify(storedValue);
            const newStr = JSON.stringify(parsed);
            if (currentStr !== newStr) setStoredValue(parsed);
          } catch (_) {
            setStoredValue(parsed);
          }
        } catch (err2) {
          console.error('[useLocalStorage] Failed to parse storage event value', err2);
          setStoredValue(initialValue);
        }
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== key) return;

      // Some browsers may dispatch storage events in the same window/tab.
      // If we just wrote to localStorage ourselves, ignore that event to prevent loops.
      const now = Date.now();
      if (lastLocalWriteRef.current && now - lastLocalWriteRef.current < 1000) {
        return;
      }

      try {
        applyNewValue(e.newValue);
      } catch (error) {
        console.error(error);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, initialValue]);

  // 4. Return the state value and the original, stable setter function from useState.
  return [storedValue, setStoredValue];
}

export default useLocalStorage;