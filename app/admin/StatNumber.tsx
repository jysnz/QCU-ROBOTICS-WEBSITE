"use client";

import { useEffect, useState } from "react";
import NumberFlow from "@number-flow/react";

/* A number that counts up from 0 when it first appears (like the numbers on the home page), then rolls smoothly
   whenever it changes later. Plain NumberFlow only animates changes, so it would otherwise just appear. */
export default function StatNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const quick = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setShown(value), quick ? 0 : 60);
    return () => clearTimeout(t);
  }, [value]);
  return <NumberFlow value={shown} transformTiming={{ duration: 1000, easing: "cubic-bezier(.16,1,.3,1)" }} spinTiming={{ duration: 1000, easing: "cubic-bezier(.16,1,.3,1)" }} />;
}
