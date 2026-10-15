import { useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

type Loaded<T> =
  | { status: 'loading'; data: undefined; error: undefined }
  | { status: 'ready'; data: T; error: undefined }
  | { status: 'error'; data: undefined; error: Error };

/** Loads when the screen comes into focus, and again on reload(). */
export function useLoad<T>(load: () => Promise<T>) {
  const [state, setState] = useState<Loaded<T>>({ status: 'loading', data: undefined, error: undefined });
  const loadRef = useRef(load);
  useLayoutEffect(() => {
    loadRef.current = load;
  });

  const reload = useCallback(async () => {
    try {
      const data = await loadRef.current();
      setState({ status: 'ready', data, error: undefined });
    } catch (error) {
      setState({ status: 'error', data: undefined, error: error instanceof Error ? error : new Error(String(error)) });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { ...state, reload };
}
