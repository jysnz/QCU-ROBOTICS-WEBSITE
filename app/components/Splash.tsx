"use client";

import { useEffect, useRef, useState } from "react";

/* Intro: the badge reveals, then flies into the header logo (.site-logo).
   Click or any key skips it. <html> starts with the "intro flying" classes (see layout.tsx);
   this removes them. Runs once per full page load: client-side navigations never remount it. */
export default function Splash() {
  const ref = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false); // unmount through React, never s.remove(): React owns this node

  useEffect(() => {
    const s = ref.current;
    const root = document.documentElement;
    if (!s) { root.classList.remove("intro", "flying"); return; }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let done = false;
    const timers: number[] = [];

    const finish = () => { root.classList.remove("flying"); setGone(true); };
    // First .site-logo that is actually on screen (the admin sign-in has two, only one is visible per breakpoint).
    const findTarget = () =>
      Array.from(document.querySelectorAll<HTMLElement>(".site-logo")).find((el) => el.getBoundingClientRect().width > 0) ?? null;

    const fly = (wrap: HTMLElement, target: HTMLElement, fast: boolean) => {
      wrap.style.animation = "none";
      const a = wrap.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const k = b.width / a.width;
      const dur = fast ? 450 : 850;
      wrap.style.transition = `transform ${dur}ms cubic-bezier(.7,0,.2,1)`;
      requestAnimationFrame(() => { wrap.style.transform = `translate(${dx}px, ${dy}px) scale(${k})`; });
      timers.push(window.setTimeout(finish, dur + 60));
    };

    const leave = (fast: boolean) => {
      if (done) return;
      done = true;
      root.classList.remove("intro");
      s.classList.add("leaving");
      const wrap = s.querySelector<HTMLElement>(".splash-logo");
      if (reduce || !wrap) { timers.push(window.setTimeout(finish, 350)); return; }
      // The target may still be loading (e.g. the admin checks your session first): wait briefly for it.
      let waited = 0;
      const tryFly = () => {
        const target = findTarget();
        if (target) { fly(wrap, target, fast); return; }
        waited += 50;
        if (waited >= 1500) { timers.push(window.setTimeout(finish, 350)); return; }
        timers.push(window.setTimeout(tryFly, 50));
      };
      tryFly();
    };

    timers.push(window.setTimeout(() => leave(false), reduce ? 700 : 2500));
    const skip = () => leave(true);
    s.addEventListener("click", skip);
    window.addEventListener("keydown", skip, { once: true });
    return () => { timers.forEach(clearTimeout); window.removeEventListener("keydown", skip); };
  }, []);

  if (gone) return null;

  return (
    <div className="splash" id="splash" ref={ref} aria-hidden="true">
      <div className="splash-bg" />
      <svg className="splash-traces" viewBox="0 0 1400 300" preserveAspectRatio="xMidYMid slice" fill="none">
        <g className="tr tr-l">
          <path pathLength="1" d="M530 150H450L420 120H300L270 90H120" /><circle cx="120" cy="90" r="5" />
          <path pathLength="1" d="M535 190H470L440 220H320L290 250H150" /><circle cx="150" cy="250" r="5" />
          <path pathLength="1" d="M525 112H480L460 92H380L360 72H250" /><circle cx="250" cy="72" r="5" />
        </g>
        <g className="tr tr-r" transform="translate(1400 0) scale(-1 1)">
          <path pathLength="1" d="M530 150H450L420 120H300L270 90H120" /><circle cx="120" cy="90" r="5" />
          <path pathLength="1" d="M535 190H470L440 220H320L290 250H150" /><circle cx="150" cy="250" r="5" />
          <path pathLength="1" d="M525 112H480L460 92H380L360 72H250" /><circle cx="250" cy="72" r="5" />
        </g>
      </svg>
      <div className="splash-in">
        <div className="splash-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={320} height={320} />
        </div>
        <p className="splash-cap">Quezon City University</p>
      </div>
    </div>
  );
}
