import { useEffect, useState } from 'react';
import { type FeedStatus, liveStore } from '../data/liveStore';

/** Re-render at most every `ms` when live data changes. Keeps React work off the hot path. */
export function useLiveTick(ms = 1000): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = liveStore.subscribe(() => {
      if (pending) return;
      pending = true;
      timer = setTimeout(() => {
        pending = false;
        setTick((x) => x + 1);
      }, ms);
    });
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, [ms]);
  return tick;
}

export function useFeedStatus(): FeedStatus {
  useLiveTick(500);
  return liveStore.status;
}

/** Re-render every `ms` (for ages/clocks). */
export function useClock(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(i);
  }, [ms]);
  return now;
}

export function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}
