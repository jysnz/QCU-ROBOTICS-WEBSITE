"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Clock } from "lucide-react";

/* When Google/Supabase sign-in comes back with "OAuth state has expired" (error_code=bad_oauth_state) the user waited too long
   on the Google screen, or opened the sign-in link in another tab/browser. Supabase redirects to the site with the error in
   the address (as ?query or #hash). This shows a clear message instead of a bare error in the address bar, and cleans the address.
   It sits in the root layout because the redirect can land on any page. */
function expiredError(): boolean {
  const params = [window.location.search, window.location.hash.replace(/^#/, "")].map((s) => new URLSearchParams(s.replace(/^\?/, "")));
  return params.some((p) => {
    const code = p.get("error_code") ?? "";
    const text = `${p.get("error_description") ?? ""} ${p.get("error") ?? ""}`.toLowerCase();
    return code === "bad_oauth_state" || (/state/.test(text) && /expired|invalid|missing/.test(text) && p.has("error"));
  });
}

export default function SessionExpiredModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!expiredError()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
    // drop the error from the address so a refresh doesn't show it again
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[300] bg-black/70 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-[310] grid place-items-center overflow-clip p-4">
          <Dialog.Popup className="w-full max-w-sm rounded-2xl border border-slate-600 bg-slate-900 p-6 text-center outline-none transition-[opacity,transform] duration-200 ease-out-quint data-[starting-style]:scale-[.97] data-[starting-style]:opacity-0 data-[ending-style]:scale-[.97] data-[ending-style]:opacity-0">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[#fbbf24]/40 bg-[#fbbf24]/10 text-[#fbbf24]"><Clock className="h-5 w-5" aria-hidden="true" /></span>
            <Dialog.Title className="mt-4 font-display text-xl font-semibold text-white">Your session has expired</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-relaxed text-slate-400">
              The sign-in took too long or was opened somewhere else, so it couldn&rsquo;t be completed. Please sign in again.
            </Dialog.Description>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <a href="/admin" className="btn btn-primary">Sign in again</a>
              <Dialog.Close className="btn btn-ghost">Close</Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
