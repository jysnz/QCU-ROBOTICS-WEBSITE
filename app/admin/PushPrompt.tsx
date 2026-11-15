"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Bell, Cake, ClipboardList, Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { enablePush, getPushState } from "./push";

/* Shown once when an admin opens the admin area and this device doesn't have notifications on yet.
   It explains what they get, then asks the browser for permission only when they press the button (browsers require a click).
   "Not now" hides it for 3 days; "Don't ask again" hides it for good on this device. */
const SNOOZE_KEY = "admin-push-prompt-until";
const DAY = 86_400_000;

const readUntil = () => { try { return Number(localStorage.getItem(SNOOZE_KEY) ?? 0) || 0; } catch { return 0; } };
const writeUntil = (t: number) => { try { localStorage.setItem(SNOOZE_KEY, String(t)); } catch { /* private window: it just asks again next time */ } };

const PERKS = [
  { icon: ClipboardList, text: "New tasks assigned to you, and reminders before they're due" },
  { icon: UserPlus, text: "New registrations and access requests waiting for review" },
  { icon: Cake, text: "Team birthdays coming up" },
] as const;

type Step = "ask" | "busy" | "done" | "blocked" | "failed";

export default function PushPrompt() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("ask");

  useEffect(() => {
    let off = false;
    let timer: number | undefined;
    (async () => {
      if (readUntil() > Date.now()) return;
      const state = await getPushState();
      if (off || state !== "off") return; // already on, blocked, not set up, or not supported: nothing to ask
      timer = window.setTimeout(() => { if (!off) setOpen(true); }, 1600); // let the dashboard settle first
    })();
    return () => { off = true; window.clearTimeout(timer); };
  }, []);

  function close(until?: number) {
    if (until) writeUntil(until);
    setOpen(false);
  }

  async function turnOn() {
    setStep("busy");
    try {
      const next = await enablePush();
      if (next === "on") {
        setStep("done");
        window.setTimeout(() => setOpen(false), 2200);
      } else {
        setStep(next === "denied" ? "blocked" : "ask"); // dismissed the browser's question: they can try again
        if (next === "denied") writeUntil(Date.now() + 30 * DAY);
      }
    } catch {
      setStep("failed");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) close(step === "done" ? undefined : Date.now() + 3 * DAY); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-[2px] transition-opacity duration-300 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-[70] grid place-items-center overflow-clip p-4">
          <Dialog.Popup className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-slate-600 bg-slate-900 p-7 text-center shadow-[0_30px_80px_rgba(0,0,0,.6)] outline-none transition-[opacity,transform] duration-300 ease-out-quint data-[starting-style]:translate-y-4 data-[starting-style]:scale-[.95] data-[starting-style]:opacity-0 data-[ending-style]:scale-[.97] data-[ending-style]:opacity-0">
            {/* soft glow behind the icon */}
            <span className="pointer-events-none absolute -top-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" aria-hidden="true" />

            <div className="relative mx-auto grid h-20 w-20 place-items-center">
              {step === "done" ? (
                <>
                  <span className="pp-burst absolute inset-0 rounded-full border-2 border-accent" aria-hidden="true" />
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-ink">
                    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path className="pp-check" d="M20 6 9 17l-5-5" /></svg>
                  </span>
                </>
              ) : (
                <>
                  <span className="pp-ripple absolute inset-2 rounded-full border border-accent/50" aria-hidden="true" />
                  <span className="pp-ripple absolute inset-2 rounded-full border border-accent/40" style={{ animationDelay: "1.2s" }} aria-hidden="true" />
                  <span className="relative grid h-16 w-16 place-items-center rounded-full border border-accent/40 bg-accent/10 text-accent">
                    <Bell className="pp-bell h-7 w-7" aria-hidden="true" />
                  </span>
                </>
              )}
            </div>

            {step === "done" ? (
              <div className="relative">
                <Dialog.Title className="pp-in mt-5 font-display text-xl font-semibold text-white">You&rsquo;re all set</Dialog.Title>
                <Dialog.Description className="pp-in mt-2 text-sm leading-relaxed text-slate-400" style={{ animationDelay: "80ms" }}>Notifications are on for this device. You&rsquo;ll be told even when the site is closed.</Dialog.Description>
              </div>
            ) : (
              <div className="relative">
                <Dialog.Title className="mt-5 font-display text-xl font-semibold text-white">Stay in the loop</Dialog.Title>
                <Dialog.Description className="mt-2 text-sm leading-relaxed text-slate-400">
                  Turn on notifications so you don&rsquo;t miss what needs you, even when this tab is closed.
                </Dialog.Description>

                <ul className="mt-5 space-y-2 text-left">
                  {PERKS.map(({ icon: Icon, text }, i) => (
                    <li key={text} className="pp-in flex items-start gap-3 rounded-xl border border-slate-700/80 bg-slate-950/50 px-3 py-2.5" style={{ animationDelay: `${i * 110 + 250}ms` }}>
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent"><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span>
                      <span className="text-sm leading-snug text-slate-300">{text}</span>
                    </li>
                  ))}
                </ul>

                {step === "blocked" && (
                  <p role="alert" className="pp-in mt-4 rounded-xl border border-[#fbbf24]/40 bg-[#fbbf24]/10 p-3 text-left text-xs leading-relaxed text-[#fbbf24]">
                    Notifications are blocked for this site. Click the lock icon next to the address, allow Notifications, then reload.
                  </p>
                )}
                {step === "failed" && (
                  <p role="alert" className="pp-in mt-4 rounded-xl border border-[#ef4444]/40 bg-[#ef4444]/10 p-3 text-left text-xs leading-relaxed text-[#f87171]">
                    Couldn&rsquo;t turn notifications on right now. Please try again in a moment.
                  </p>
                )}

                <div className="mt-6 flex flex-col gap-2">
                  {step === "blocked" ? (
                    <button type="button" onClick={() => close()} className="btn btn-primary">Got it</button>
                  ) : (
                    <button type="button" onClick={turnOn} disabled={step === "busy"} className="btn btn-primary group disabled:opacity-70">
                      {step === "busy" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Bell className="h-4 w-4 transition-transform duration-200 group-hover:-rotate-12" aria-hidden="true" />}
                      {step === "busy" ? "Waiting for your browser…" : "Turn on notifications"}
                    </button>
                  )}
                  {step !== "blocked" && (
                    <button type="button" onClick={() => close(Date.now() + 3 * DAY)} disabled={step === "busy"} className="btn btn-ghost disabled:opacity-50">Not now</button>
                  )}
                  <button type="button" onClick={() => close(Date.now() + 3650 * DAY)} disabled={step === "busy"} className="mx-auto mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500 underline-offset-4 transition-colors hover:text-slate-300 hover:underline disabled:opacity-50">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Don&rsquo;t ask again on this device
                  </button>
                </div>
              </div>
            )}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
