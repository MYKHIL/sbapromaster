// FIX: The `React` namespace, required for types like `React.Dispatch`, was missing from the import.
import React, { useState, useEffect } from 'react';
import * as LZ from 'lz-string';

function useLocalStorage<T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
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
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const jsonString = JSON.stringify(storedValue);
        const compressed = LZ.compress(jsonString);
        window.localStorage.setItem(key, compressed);
      }
    } catch (error: any) {
      if (error && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        console.warn(`[useLocalStorage] ⚠️ Storage quota exceeded for key "${key}". Compression enabled but data exceeds limits. Consider archiving old data.`);
      } else {
        console.error(`[useLocalStorage] Error setting key "${key}":`, error);
      }
    }
  }, [key, storedValue]);

  // 3. useEffect to listen for changes to the same localStorage key from other tabs.
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        try {
          if (!e.newValue) {
            setStoredValue(initialValue);
          } else {
            // Try decompressing first (new format)
            try {
              const decompressed = LZ.decompress(e.newValue);
              setStoredValue(decompressed ? JSON.parse(decompressed) : initialValue);
            } catch (e) {
              // Fallback: try parsing as regular JSON
              setStoredValue(JSON.parse(e.newValue));
            }
          }
        } catch (error) {
          console.error(error);
          setStoredValue(initialValue);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, initialValue]);

  // 4. Return the state value and the original, stable setter function from useState.
  return [storedValue, setStoredValue];
}

export default useLocalStorage;