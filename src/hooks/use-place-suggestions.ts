import { useEffect, useState } from 'react';

import { barry, type Place } from '@/lib/barry';

// Long enough that typing a name sends one search, not one per letter.
const SUGGEST_DELAY_MS = 300;
const MIN_LETTERS = 2;

/** The places Apple Maps finds for what is typed, or none while there is no query to search for. */
export function usePlaceSuggestions(query: string | null): Place[] {
  const [places, setPlaces] = useState<Place[]>([]);
  const searching = query !== null && query.trim().length >= MIN_LETTERS;

  useEffect(() => {
    if (!searching) return;
    let current = true;
    const timer = setTimeout(() => {
      barry.findPlaces(query).then(
        (next) => current && setPlaces(next),
        () => undefined,
      );
    }, SUGGEST_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, searching]);

  // Keeps the last places while the next search runs, so the list does not flicker as you type.
  return searching ? places : [];
}
