"use client";

import { LogOut, Lock, ShieldCheck } from "lucide-react";
import PasswordFlow from "./PasswordFlow";

/* Every admin account needs a password, including accounts that signed in with Google. An approved account without one
   lands here before the dashboard: a code is emailed, then the password is chosen. Google sign-in keeps working too. */
/** A first name for the greeting. Names come as "Jayson Dela Cruz" or school-style "Dela Cruz, Jayson D." (the part after the comma). */
function firstNameOf(full: string): string {
  const clean = full.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const word = clean.includes(",") ? clean.split(",")[1].trim().split(" ")[0] : clean.split(" ")[0];
  return word.replace(/[^\p{L}'-]/gu, "");
}

export default function RequirePassword({ email, name, onDone, onSignOut }: { email: string; name: string; onDone: () => void; onSignOut: () => void }) {
  const first = firstNameOf(name);
  return (
    <div>
      <div className="text-center">
        <span className="relative mx-auto grid h-20 w-20 place-items-center" aria-hidden="true">
          <span className="pp-ripple absolute inset-2 rounded-full border border-accent/50" />
          <span className="pp-ripple absolute inset-2 rounded-full border border-accent/40" style={{ animationDelay: "1.2s" }} />
          <span className="relative grid h-16 w-16 place-items-center rounded-full border border-accent/40 bg-accent/10 text-accent"><Lock className="h-7 w-7" /></span>
        </span>
        <p className="kicker pp-in mt-6" style={{ animationDelay: "120ms" }}>{first ? `Welcome, ${first}` : "Welcome"}</p>
        <h1 className="pp-in mt-2 font-display text-3xl font-bold text-white" style={{ animationDelay: "200ms" }}>Create a password</h1>
        <p className="pp-in mx-auto mt-3 max-w-sm text-slate-400" style={{ animationDelay: "280ms" }}>Every account needs a password to use the admin area. You can still sign in with Google afterwards.</p>
      </div>

      <div className="pp-in mt-7" style={{ animationDelay: "360ms" }}>
        <PasswordFlow email={email} has={false} hideHeader finishLabel="Continue to the admin area" onFinish={onDone} />
      </div>

      <div className="pp-in mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500" style={{ animationDelay: "440ms" }}>
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" /> Your password is stored securely</span>
        <button type="button" onClick={onSignOut} className="inline-flex items-center gap-1.5 transition-colors hover:text-white"><LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Sign out</button>
      </div>
    </div>
  );
}
