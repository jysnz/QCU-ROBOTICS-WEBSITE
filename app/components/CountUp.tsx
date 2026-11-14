"use client";

import { useEffect, useRef, useState } from 'react';

// Counts up once when scrolled into view (after the intro). Renders the real value first, so no-JS and SSR stay correct.
export default function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches || value <= 0) { setShown(value); return; }
    let raf = 0;
    let started = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setShown(0);
    const run = () => {
      started = true;
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min((t - t0) / 1000, 1);
        setShown(Math.round(value * (1 - Math.pow(1 - p, 4))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const wait = () => {
      if (document.documentElement.classList.contains('intro')) timer = setTimeout(wait, 120);
      else run();
    };
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started) return;
      io.disconnect();
      wait();
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); if (timer) clearTimeout(timer); };
  }, [value]);
  return <span ref={ref}>{shown}</span>;
}
