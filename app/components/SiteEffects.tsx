"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/* Scroll-reveal: any [data-reveal] element fades up once when it enters the viewport.
   Deliberately never writes attributes or classes on those elements: React owns them, and
   changing them before hydration finishes causes hydration mismatches. The animation runs through
   the Web Animations API (fill: "forwards" overrides the CSS hidden state), and "seen" lives in a WeakSet. */
export default function SiteEffects() {
  const pathname = usePathname();

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;
    if (!reduce) root.classList.add("reveal-ready");

    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);
          e.target.animate(
            [{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }],
            { duration: 600, easing: "cubic-bezier(.2,0,0,1)", fill: "forwards" },
          );
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 },
    );
    const scan = () => document.querySelectorAll("[data-reveal]").forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      io.observe(el);
    });
    scan();
    const mo = new MutationObserver(scan); // content that renders after data loads
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, [pathname]);

  return null;
}
