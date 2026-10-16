import { useEffect, useState } from 'react';

const INTERVAL_MS = 30_000;

export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}
