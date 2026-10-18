import { useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

type Loaded<T> =
  | { status: 'loading'; data: undefined; error: undefined }
  | { status: 'ready'; data: T; error: undefined }
  | { status: 'error'; data: T | undefined; error: Error };

/**
 * Loads when the screen comes into focus or the app returns to the foreground, and again on
 * reload(). Only the newest request lands, so a slow older one cannot overwrite fresh data. A
 * reload that fails keeps the data already shown, so a form in progress is not thrown away.
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
        const failure = error instanceof Error ? error : new Error(String(error));
        setState((before) => ({ status: 'error', data: before.data, error: failure }));
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
