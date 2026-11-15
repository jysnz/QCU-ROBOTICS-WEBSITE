"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Menu } from "@base-ui/react/menu";
import { Crown, Loader2, MoreVertical } from "lucide-react";
import { notify } from "./notify";
import { adminFetch, sb } from "./supabase";
import { bustContent } from "./cache";

/* The media head: the one account prompted to hand out competition tasks to the media team (see
   supabase/competition-tasks.sql). Media team items in the Media team page carry a three-dot menu for the super admin,
   and assigning a new head replaces the old one. A media team member isn't tied to a login, so the dialog asks which
   account is theirs and stores it on the role. */
export type Head = { user_id: string; media_team_id: number | null };
/** A media head who has no account yet: named from a registration, becomes head when they create an account with that email. */
export type PendingHead = { email: string; full_name: string | null; media_team_id: number | null };
/** What a Media team card's three-dot menu offers: nothing (no menu), assign, remove, or hand the role over (the head herself). */
export type HeadAction = "assign" | "remove" | "transfer" | null;

/** The media head's card on the Media team page shows "Media head" as their position; the previous head's card goes back to empty.
    Pass null to clear it (no head any more). Only a position that is exactly "Media head" is ever touched. */
export const HEAD_POSITION = "Media head";
export async function markHeadPosition(id: number | null) {
  const cleared = await sb.from("media_team").update({ position: null }).eq("position", HEAD_POSITION).neq("id", id ?? -1);
  const set = id === null ? { error: null } : await sb.from("media_team").update({ position: HEAD_POSITION }).eq("id", id);
  bustContent();
  return cleared.error?.message ?? set.error?.message ?? null;
}

export function useMediaHead(enabled: boolean) {
  const [head, setHead] = useState<Head | null>(null);
  const [pendingHead, setPendingHead] = useState<PendingHead | null>(null);
  const [me, setMe] = useState("");
  const load = useCallback(async () => {
    const [{ data }, pend, { data: s }] = await Promise.all([
      sb.from("admin_roles").select("user_id, media_team_id").eq("role", "media_head").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      sb.schema("public").rpc("list_pending_roles"), // errors (database not set up yet) just mean "nobody is waiting"
      sb.auth.getSession(),
    ]);
    setHead((data as Head | null) ?? null);
    setPendingHead(((pend.data ?? []) as (PendingHead & { role: string })[]).find((p) => p.role === "media_head") ?? null);
    setMe(s.session?.user.id ?? "");
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (enabled) load();
  }, [enabled, load]);
  return { head, pendingHead, me, reload: load };
}

export function HeadBadge({ className = "" }: { className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[.6rem] uppercase tracking-[.12em] text-accent ${className}`}><Crown className="h-3 w-3" aria-hidden="true" /> Media head</span>;
}

export function HeadMenu({ name, action, onAssign, onRemove, variant }: { name: string; action: Exclude<HeadAction, null>; onAssign: () => void; onRemove: () => void; variant: "grid" | "list" }) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`More actions for ${name}`}
        className={`grid h-9 w-9 place-items-center rounded-lg transition-colors data-[popup-open]:bg-slate-800 ${variant === "grid" ? "bg-slate-950/70 text-white backdrop-blur hover:bg-slate-800" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
      >
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={6} className="z-[60]">
          <Menu.Popup className="min-w-56 origin-[var(--transform-origin)] rounded-xl border border-slate-600 bg-slate-900 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,.55)] outline-none transition-[opacity,transform] duration-150 ease-out-quint data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 motion-reduce:transition-none">
            <Menu.Item onClick={action === "remove" ? onRemove : onAssign} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none data-[highlighted]:bg-slate-800 data-[highlighted]:text-white">
              <Crown className={`h-4 w-4 ${action === "remove" ? "text-slate-500" : "text-accent"}`} aria-hidden="true" />
              {action === "remove" ? "Remove as media head" : action === "transfer" ? "Transfer media head here" : "Assign as media head"}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** Someone who can be the head: an admin account and/or a /member-reg registration, joined by email (accountId null = no account yet). */
type Account = { email: string; name: string; accountId: string | null; approved: boolean };
const tokens = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((t) => t.length > 1);
/** Best guess at who a Media team member is, by shared name words. */
function guess(member: string, accounts: Account[]) {
  const m = tokens(member);
  let best = ""; let score = 0;
  for (const a of accounts) {
    const t = new Set(tokens(a.name || ""));
    const s = m.filter((x) => t.has(x)).length;
    if (s > score) { score = s; best = a.email; }
  }
  return score >= Math.min(2, m.length) && score > 0 ? best : "";
}

export function AssignHeadDialog({ member, currentName, transfer = false, onClose, onDone }: { member: { id: number; name: string } | null; currentName: string | null; transfer?: boolean; onClose: () => void; onDone: () => void }) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [pick, setPick] = useState(""); // an email
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ id: number; name: string } | null>(null);
  if (member && member !== last) setLast(member); // keep the text while the dialog fades out

  useEffect(() => {
    if (!member) return;
    let off = false;
    (async () => {
      // Accounts AND everyone who registered at /member-reg: someone without an account yet can be named too, and gets the role the moment they create one.
      const [{ people }, { data: sup }] = await Promise.all([
        adminFetch<{ people: Account[] }>("/api/admin/role-candidates"),
        sb.from("admin_roles").select("user_id").eq("role", "super_admin"),
      ]);
      if (off) return;
      const skip = new Set((sup ?? []).map((r) => r.user_id)); // the super admin already can do everything a head can
      const list = people.filter((p) => !(p.accountId && skip.has(p.accountId)));
      setAccounts(list);
      setPick(guess(member.name, list));
    })().catch(() => { if (!off) setAccounts([]); });
    return () => { off = true; setAccounts(null); setPick(""); };
  }, [member]);

  const shownName = member?.name ?? last?.name ?? "";
  const options = useMemo(() => accounts ?? [], [accounts]);
  const chosen = options.find((a) => a.email === pick);

  async function confirm() {
    if (!member || !chosen) return;
    setBusy(true);
    // someone with an account becomes head right away; someone without one is saved against their email and becomes head when they sign up
    const { data, error } = chosen.accountId
      ? await sb.schema("public").rpc("set_media_head", { uid: chosen.accountId, member: member.id })
      : await sb.schema("public").rpc("assign_role_by_email", { p_email: chosen.email, p_role: "media_head", p_name: chosen.name, p_media_team: member.id });
    setBusy(false);
    if (error) {
      const setup = !chosen.accountId && /could not find the function|assign_role_by_email/i.test(error.message);
      notify.error("Couldn't assign the media head.", { description: setup ? "The database isn't set up for this yet. Run supabase/pending-roles.sql in the Supabase SQL editor first." : error.message });
      return;
    }
    const later = !chosen.accountId || data === "pending";
    notify.created(member.name, { description: transfer ? (later ? `Gets the media head role as soon as they create an account with ${chosen.email}. You are no longer media head.` : "Is now the media head. You are no longer media head.") : later ? `Will be the media head as soon as they create an account with ${chosen.email}.` : currentName && currentName !== member.name ? `Is now the media head, replacing ${currentName}.` : "Is now the media head." });
    const posErr = await markHeadPosition(member.id);
    if (posErr) notify.error("The media head was set, but their position couldn't be updated.", { description: posErr });
    onDone();
    onClose();
  }

  return (
    <Dialog.Root open={member !== null} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
          <Dialog.Popup className="w-full max-w-sm rounded-2xl border border-slate-600 bg-slate-900 p-6 outline-none transition-[opacity,transform] duration-200 ease-out-quint data-[starting-style]:scale-[.97] data-[starting-style]:opacity-0 data-[ending-style]:scale-[.97] data-[ending-style]:opacity-0">
            <span className="mb-4 grid h-10 w-10 place-items-center rounded-full bg-accent/15 text-accent"><Crown className="h-5 w-5" aria-hidden="true" /></span>
            <Dialog.Title className="font-display text-xl font-semibold text-white">{transfer ? "Transfer the media head role to" : "Assign"} {shownName}{transfer ? "?" : " as media head?"}</Dialog.Title>
            <Dialog.Description className="mt-3 text-sm leading-relaxed text-slate-400">
              When a competition is coming up, the media head is prompted to hand out the media tasks.{transfer ? <> You will no longer be media head: the role moves to {shownName}.</> : currentName && currentName !== shownName ? <> <span className="text-white">{currentName}</span> will no longer be media head.</> : null}
            </Dialog.Description>
            <label className="mt-5 block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">Which email does {shownName} use?</span>
              {accounts === null ? <span className="block h-11 animate-pulse rounded-xl bg-slate-800" aria-hidden="true" /> : (
                <select value={pick} onChange={(e) => setPick(e.target.value)} className="h-11 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 text-sm text-white outline-none! transition-colors hover:border-slate-500 focus-visible:border-accent">
                  <option value="">Choose an email…</option>
                  {options.map((a) => <option key={a.email} value={a.email}>{a.name}{a.name !== a.email ? ` (${a.email})` : ""}{a.accountId ? (a.approved ? "" : " · waiting for approval") : " · no account yet"}</option>)}
                </select>
              )}
              {chosen && !chosen.accountId && <span className="mt-2 block text-xs leading-relaxed text-slate-400">{shownName} hasn&rsquo;t made an account yet. They become the media head as soon as they create one with <span className="text-white">{chosen.email}</span>.</span>}
              {chosen?.accountId && !chosen.approved && <span className="mt-2 block text-xs leading-relaxed text-slate-400">This account is still waiting for approval. The role starts working once you approve it.</span>}
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <Dialog.Close className="btn btn-ghost">Cancel</Dialog.Close>
              <button type="button" onClick={confirm} disabled={!pick || busy} className="btn btn-primary disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Assign</button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export async function clearMediaHead(name: string, reload: () => void, pendingEmail?: string) {
  // a head who has no account yet is only saved against their email; one with an account is a role
  const { error } = pendingEmail ? await sb.schema("public").rpc("clear_pending_role", { p_email: pendingEmail }) : await sb.schema("public").rpc("clear_media_head");
  if (error) { notify.error("Couldn't remove the media head.", { description: error.message }); return; }
  await markHeadPosition(null);
  notify.deleted(`${name} is no longer the media head`);
  reload();
}
