"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "./supabase";

/* How many registrations and accounts are waiting for a decision, for the sidebar badges.
   Reloads when `refreshKey` changes (the section you're in), when the tab regains focus, every minute, and right away when
   Registrations or Accounts announce a decision with the "admin-review-changed" event. */
export const REVIEW_EVENT = "admin-review-changed";
export const announceReviewChange = () => window.dispatchEvent(new Event(REVIEW_EVENT));

export function useReviewCounts(refreshKey: string) {
  const [counts, setCounts] = useState<{ registrations: number; accounts: number }>({ registrations: 0, accounts: 0 });
  useEffect(() => {
    let off = false;
    const load = () => {
      adminFetch<{ registrations: number; accounts: number }>("/api/admin/review-counts")
        .then((c) => { if (!off) setCounts(c); })
        .catch(() => { /* keep the last numbers */ });
    };
    load();
    const timer = window.setInterval(load, 60_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener(REVIEW_EVENT, load);
    return () => { off = true; window.clearInterval(timer); window.removeEventListener("focus", onFocus); window.removeEventListener(REVIEW_EVENT, load); };
  }, [refreshKey]);
  return counts;
}
