import { useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

type Loaded<T> =
  | { status: 'loading'; data: undefined; error: undefined }
  | { status: 'ready'; data: T; error: undefined }
  | { status: 'error'; data: undefined; error: Error };

/**
 * Loads when the screen comes into focus or the app returns to the foreground, and again on
 * reload(). Only the newest request lands, so a slow older one cannot overwrite fresh data.
 */
export function useLoad<T>(load: () => Promise<T>) {
  const [state, setState] = useState<Loaded<T>>({ status: 'loading', data: undefined, error: undefined });
  const loadRef = useRef(load);
  useLayoutEffect(() => {
    loadRef.current = load;
  });
  const requests = useRef(0);

  const reload = useCallback(async () => {
    const request = ++requests.current;
    try {
      const data = await loadRef.current();
      if (request === requests.current) setState({ status: 'ready', data, error: undefined });
    } catch (error) {
      if (request === requests.current) {
        setState({ status: 'error', data: undefined, error: error instanceof Error ? error : new Error(String(error)) });
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
      const subscription = AppState.addEventListener('change', (next) => next === 'active' && reload());
      return () => subscription.remove();
    }, [reload]),
  );

  return { ...state, reload };
}
