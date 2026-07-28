import { useEffect, useRef, useState } from "react";

// Slow to warn, quick to reassure: a momentary drop shouldn't flash a banner,
// but recovering from one should clear it almost immediately.
const OFFLINE_DELAY = 3000;
const ONLINE_DELAY = 1000;

const useOffline = (): boolean => {
  const [isOffline, setIsOffline] = useState<boolean>(() => !navigator.onLine);
  const timer = useRef<number>();

  useEffect(() => {
    // navigator.onLine is re-read when the timer fires rather than trusting the
    // event that scheduled it, since the connection may have flipped back
    // during the delay. Clearing first keeps a rapid offline/online flap from
    // stacking timers.
    const schedule = (delay: number) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(
        () => setIsOffline(!navigator.onLine),
        delay
      );
    };

    const handleOffline = () => schedule(OFFLINE_DELAY);
    const handleOnline = () => schedule(ONLINE_DELAY);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.clearTimeout(timer.current);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return isOffline;
};

export default useOffline;
