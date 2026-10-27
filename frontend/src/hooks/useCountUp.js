import { useEffect, useState } from 'react';

// Counts up from 0 to target with an ease-out; jumps straight there when the
// viewer prefers reduced motion
const useCountUp = (target, duration = 1800) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
};

export default useCountUp;
