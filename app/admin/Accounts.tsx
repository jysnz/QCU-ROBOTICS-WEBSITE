"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import NumberFlow from "@number-flow/react";
import { notify } from "./notify";
import { Check, Loader2, RotateCcw, Search, ShieldCheck, ShieldOff, UserCheck, UserX } from "lucide-react";
import { adminFetch } from "./supabase";
import { announceReviewChange } from "./useReviewCounts";

type Account = { id: string; email: string; full_name: string | null; avatar_url: string | null; created_at: string; is_approved: boolean; rejected_at?: string | null };

const ARCHIVE_DAYS = 30;
const daysLeft = (iso?: string | null) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() + ARCHIVE_DAYS * 86_400_000 - Date.now()) / 86_400_000)) : ARCHIVE_DAYS);

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "just now";
  const units: [number, Intl.RelativeTimeFormatUnit][] = [[60, "minute"], [3600, "hour"], [86400, "day"], [604800, "week"], [2629800, "month"], [31557600, "year"]];
  let i = 0;
  while (i < units.length - 1 && abs >= units[i + 1][0]) i++;
  return rtf.format(Math.round(diff / units[i][0]), units[i][1]);
}

function Avatar({ a }: { a: Account }) {
  const [broken, setBroken] = useState(false);
  const initial = ((a.full_name || a.email).trim()[0] ?? "?").toUpperCase();
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-slate-600 bg-slate-800 font-display text-base font-semibold text-slate-300">
      {a.avatar_url && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.avatar_url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : initial}
    </span>
  );
}

function AccountRow({
  a, isMe, busy, leaving, delay, onApprove, onRevoke, onReject, onRestore,
}: {
  a: Account; isMe: boolean; busy: boolean; leaving: boolean; delay: number; onApprove: () => void; onRevoke: () => void; onReject: () => void; onRestore: () => void;
}) {
  return (
    // grid-rows collapse so the rows below slide up when this one is decided
    <li style={{ animation: "rise .5s var(--ease) both", animationDelay: `${delay}ms` }} className={`grid transition-[grid-template-rows,opacity] duration-[380ms] ease-out-quint ${leaving ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}>
      <div className="min-h-0 overflow-hidden">
        <div className={`flex flex-col gap-3 rounded-2xl border p-4 transition-colors duration-200 hover:border-slate-600 sm:flex-row sm:items-center ${a.is_approved || a.rejected_at ? "border-slate-700 bg-slate-900" : "border-accent/40 bg-accent/[.04]"}`}>
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Avatar a={a} />
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-white">
                <span className="truncate">{a.full_name || a.email}</span>
                {isMe && <span className="rounded-md border border-accent/40 px-1.5 py-0.5 font-mono text-[.62rem] uppercase tracking-[.14em] text-accent">You</span>}
              </p>
              <p className="truncate text-xs text-slate-400">{a.full_name ? a.email : "No name set"}</p>
              <p className="mt-0.5 font-mono text-[.68rem] text-slate-500" title={new Date(a.created_at).toLocaleString()}>Joined {ago(a.created_at)}</p>
            </div>
          </div>

          {a.is_approved ? (
            isMe ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400"><ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" /> Approved</span>
            ) : (
              <button type="button" disabled={busy} onClick={onRevoke} className="btn btn-ghost btn-sm shrink-0 disabled:opacity-60">
                <ShieldOff className="h-4 w-4" aria-hidden="true" /> Revoke access
              </button>
            )
          ) : a.rejected_at ? (
            <div className="flex w-full shrink-0 items-center gap-3 sm:w-auto">
              <span className="font-mono text-[.68rem] text-slate-400">Deleted in {daysLeft(a.rejected_at)} {daysLeft(a.rejected_at) === 1 ? "day" : "days"}</span>
              <button type="button" disabled={busy} onClick={onRestore} className="btn btn-ghost btn-sm disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />} Restore
              </button>
            </div>
          ) : (
            <div className="flex w-full shrink-0 gap-2 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
              <button type="button" disabled={busy} onClick={onReject} className="btn btn-ghost btn-sm disabled:opacity-60">
                <UserX className="h-4 w-4" aria-hidden="true" /> Reject
              </button>
              <button type="button" disabled={busy} onClick={onApprove} className="btn btn-primary btn-sm disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />} Approve
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/* Approve, reject or revoke who can use /admin. New sign-ups appear under "Waiting". */
export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [me, setMe] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"waiting" | "approved" | "archived">("waiting");
  const [query, setQuery] = useState("");
  const [revoking, setRevoking] = useState<Account | null>(null);
  const [rejecting, setRejecting] = useState<Account | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const body = await adminFetch<{ accounts: Account[]; me: string }>("/api/admin/users");
      setAccounts(body.accounts);
      setMe(body.me);
      // land on whichever list has something to do
      setTab(body.accounts.some((a) => !a.is_approved && !a.rejected_at) ? "waiting" : "approved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load accounts.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function setApproved(a: Account, approved: boolean) {
    setBusy(a.id);
    try {
      await adminFetch("/api/admin/users", { method: "PATCH", body: JSON.stringify({ id: a.id, approved }) });
      announceReviewChange();
      if (approved) notify.updated(`${a.full_name || a.email} approved`, { description: "They can now use the admin area." });
      else notify.deleted(`Removed access for ${a.full_name || a.email}`);
      setLeaving((s) => new Set(s).add(a.id));
      setTimeout(() => {
        setAccounts((prev) => prev.map((x) => (x.id === a.id ? { ...x, is_approved: approved } : x)));
        setLeaving((s) => { const n = new Set(s); n.delete(a.id); return n; });
      }, 380);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "That didn't work.");
    }
    setBusy(null);
  }

  async function reject(a: Account) {
    setBusy(a.id);
    try {
      await adminFetch("/api/admin/users", { method: "DELETE", body: JSON.stringify({ id: a.id }) });
      announceReviewChange();
      notify.deleted(`${a.full_name || a.email} rejected`, { description: `Moved to the archive. It's deleted permanently after ${ARCHIVE_DAYS} days.` });
      setLeaving((s) => new Set(s).add(a.id));
      setTimeout(() => {
        setAccounts((prev) => prev.map((x) => (x.id === a.id ? { ...x, rejected_at: new Date().toISOString() } : x)));
        setLeaving((s) => { const n = new Set(s); n.delete(a.id); return n; });
      }, 380);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "That didn't work.");
    }
    setBusy(null);
  }

  async function restore(a: Account) {
    setBusy(a.id);
    try {
      await adminFetch("/api/admin/users", { method: "PATCH", body: JSON.stringify({ id: a.id, restore: true }) });
      announceReviewChange();
      notify.updated(`${a.full_name || a.email} restored`, { description: "Back under Waiting." });
      setLeaving((s) => new Set(s).add(a.id));
      setTimeout(() => {
        setAccounts((prev) => prev.map((x) => (x.id === a.id ? { ...x, rejected_at: null } : x)));
        setLeaving((s) => { const n = new Set(s); n.delete(a.id); return n; });
      }, 380);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "That didn't work.");
    }
    setBusy(null);
  }

  const waiting = useMemo(() => accounts.filter((a) => !a.is_approved && !a.rejected_at), [accounts]);
  const approved = useMemo(() => accounts.filter((a) => a.is_approved), [accounts]);
  const archived = useMemo(() => accounts.filter((a) => !a.is_approved && !!a.rejected_at), [accounts]);
  const list = tab === "waiting" ? waiting : tab === "approved" ? approved : archived;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? list.filter((a) => `${a.full_name ?? ""} ${a.email}`.toLowerCase().includes(q)) : list;
  }, [list, query]);

  return (
    <section aria-labelledby="panel-title">
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <h1 id="panel-title" className="font-display text-3xl font-bold tracking-[-0.03em] text-white">Accounts</h1>
          <p className="mt-2 text-slate-400">Everyone who has signed up for the admin area. Only approved accounts can manage the website.</p>
        </div>
        <dl className="flex gap-3">
          {([["Waiting", waiting.length], ["Approved", approved.length], ["Archived", archived.length]] as const).map(([k, n]) => (
            <div key={k} className="min-w-24 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
              <dt className="text-xs text-slate-400">{k}</dt>
              <dd className="font-display text-2xl font-bold tabular-nums text-white"><NumberFlow value={n} /></dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit gap-1 rounded-xl border border-slate-600 bg-slate-900 p-1" role="tablist" aria-label="Account status">
          {(["waiting", "approved", "archived"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={tab === f}
              onClick={() => setTab(f)}
              className={`relative h-10 rounded-lg px-5 text-sm font-semibold transition-colors duration-200 ${tab === f ? "bg-accent text-accent-ink" : "text-slate-300 hover:text-white"}`}
            >
              {f === "waiting" ? "Waiting" : f === "approved" ? "Approved" : "Archive"}
              <span className={`ml-2 font-mono text-xs ${tab === f ? "text-accent-ink/70" : "text-slate-500"}`}>{f === "waiting" ? waiting.length : f === "approved" ? approved.length : archived.length}</span>
              {f === "waiting" && waiting.length > 0 && tab !== f && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" style={{ animation: "blink 1.8s ease-in-out infinite" }} aria-hidden="true" />}
            </button>
          ))}
        </div>
        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Search accounts</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email" className="h-11 w-full rounded-xl border border-slate-600 bg-slate-900 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-slate-500 hover:border-slate-500 focus-visible:border-accent" />
        </label>
      </div>

      {error && <p role="alert" className="mb-5 rounded-xl border border-[#ef4444]/40 p-3 text-sm text-[#f87171]">{error}</p>}

      {loading ? (
        <div className="space-y-3" aria-hidden="true">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex animate-pulse items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900 p-4">
              <div className="h-11 w-11 rounded-full bg-slate-800" />
              <div className="flex-1 space-y-2"><div className="h-4 w-1/3 rounded bg-slate-800" /><div className="h-3 w-1/2 rounded bg-slate-800" /></div>
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-slate-600 px-6 py-16 text-center">
          <UserCheck className="h-8 w-8 text-slate-500" aria-hidden="true" />
          <p className="mt-4 font-medium text-white">{query ? "No accounts match that search" : tab === "waiting" ? "No one is waiting" : tab === "approved" ? "No approved accounts" : "The archive is empty"}</p>
          <p className="mt-1 max-w-sm text-sm text-slate-400">{query ? "Try a different name or email." : tab === "waiting" ? "New sign-ups appear here until someone approves them." : tab === "approved" ? "Approved accounts are listed here." : `Rejected accounts are kept here for ${ARCHIVE_DAYS} days, then deleted permanently.`}</p>
        </div>
      ) : (
        <ul className="space-y-3" key={`${tab}-${query}`}>
          {shown.map((a, i) => (
            <AccountRow
              key={a.id}
              a={a}
              isMe={a.id === me}
              busy={busy === a.id}
              leaving={leaving.has(a.id)}
              delay={Math.min(i, 8) * 45}
              onApprove={() => setApproved(a, true)}
              onRevoke={() => setRevoking(a)}
              onReject={() => setRejecting(a)}
              onRestore={() => restore(a)}
            />
          ))}
        </ul>
      )}

      {/* Reject confirmation */}
      <Dialog.Root open={rejecting !== null} onOpenChange={(o) => { if (!o) setRejecting(null); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
          <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
            <Dialog.Popup className="w-full max-w-sm rounded-2xl border border-slate-600 bg-slate-900 p-6 outline-none transition-[opacity,transform] duration-200 ease-out-quint data-[starting-style]:scale-[.97] data-[starting-style]:opacity-0 data-[ending-style]:scale-[.97] data-[ending-style]:opacity-0">
              <Dialog.Title className="font-display text-xl font-semibold text-white">Reject this account?</Dialog.Title>
              <Dialog.Description className="mt-3 text-sm text-slate-400">
                <span className="text-white">{rejecting?.full_name || rejecting?.email}</span> will be moved to the archive and won&rsquo;t be able to use the admin area. The account is deleted permanently after 30 days, and you can restore it until then.
              </Dialog.Description>
              <div className="mt-6 flex justify-end gap-3">
                <Dialog.Close className="btn btn-ghost">Cancel</Dialog.Close>
                <button type="button" onClick={() => { const a = rejecting; setRejecting(null); if (a) reject(a); }} className="btn bg-[#ef4444] text-white hover:bg-[#f87171]">Reject</button>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Revoke confirmation */}
      <Dialog.Root open={revoking !== null} onOpenChange={(o) => { if (!o) setRevoking(null); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
          <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
            <Dialog.Popup className="w-full max-w-sm rounded-2xl border border-slate-600 bg-slate-900 p-6 outline-none transition-[opacity,transform] duration-200 ease-out-quint data-[starting-style]:scale-[.97] data-[starting-style]:opacity-0 data-[ending-style]:scale-[.97] data-[ending-style]:opacity-0">
              <Dialog.Title className="font-display text-xl font-semibold text-white">Remove admin access?</Dialog.Title>
              <Dialog.Description className="mt-3 text-sm text-slate-400">
                <span className="text-white">{revoking?.full_name || revoking?.email}</span> will no longer be able to manage the website. They can be approved again later.
              </Dialog.Description>
              <div className="mt-6 flex justify-end gap-3">
                <Dialog.Close className="btn btn-ghost">Cancel</Dialog.Close>
                <button type="button" onClick={() => { const a = revoking; setRevoking(null); if (a) setApproved(a, false); }} className="btn bg-[#ef4444] text-white hover:bg-[#f87171]">Remove access</button>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
