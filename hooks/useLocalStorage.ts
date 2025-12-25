// FIX: The `React` namespace, required for types like `React.Dispatch`, was missing from the import.
import React, { useState, useEffect } from 'react';

function useLocalStorage<T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  // 1. State to store our value. The logic inside useState runs only once on initial render.
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  // 2. useEffect to automatically update localStorage whenever the state changes.
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      }
    } catch (error: any) {
      if (error && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        console.warn(`[useLocalStorage] Storage quota exceeded for key "${key}". Data will not be persisted to localStorage.`);
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
          setStoredValue(e.newValue ? JSON.parse(e.newValue) : initialValue);
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