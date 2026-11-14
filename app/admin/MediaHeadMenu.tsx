"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Menu } from "@base-ui/react/menu";
import { Crown, Loader2, MoreVertical } from "lucide-react";
import { notify } from "./notify";
import { adminFetch, sb } from "./supabase";

/* The media head: the one account prompted to hand out competition tasks to the media team (see
   supabase/competition-tasks.sql). Media team items in the Media team page carry a three-dot menu for the super admin,
   and assigning a new head replaces the old one. A media team member isn't tied to a login, so the dialog asks which
   account is theirs and stores it on the role. */
export type Head = { user_id: string; media_team_id: number | null };

export function useMediaHead(enabled: boolean) {
  const [head, setHead] = useState<Head | null>(null);
  const load = useCallback(async () => {
    const { data } = await sb.from("admin_roles").select("user_id, media_team_id").eq("role", "media_head").order("created_at", { ascending: false }).limit(1).maybeSingle();
    setHead((data as Head | null) ?? null);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (enabled) load();
  }, [enabled, load]);
  return { head, reload: load };
}

export function HeadBadge({ className = "" }: { className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[.6rem] uppercase tracking-[.12em] text-accent ${className}`}><Crown className="h-3 w-3" aria-hidden="true" /> Media head</span>;
}

export function HeadMenu({ name, isHead, onAssign, onRemove, variant }: { name: string; isHead: boolean; onAssign: () => void; onRemove: () => void; variant: "grid" | "list" }) {
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
            <Menu.Item onClick={isHead ? onRemove : onAssign} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none data-[highlighted]:bg-slate-800 data-[highlighted]:text-white">
              <Crown className={`h-4 w-4 ${isHead ? "text-slate-500" : "text-accent"}`} aria-hidden="true" />
              {isHead ? "Remove as media head" : "Assign as media head"}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

type Account = { id: string; email: string; full_name: string | null };
const tokens = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((t) => t.length > 1);
/** Best guess at which account belongs to a member, by shared name words. */
function guess(member: string, accounts: Account[]) {
  const m = tokens(member);
  let best = ""; let score = 0;
  for (const a of accounts) {
    const t = new Set(tokens(a.full_name || ""));
    const s = m.filter((x) => t.has(x)).length;
    if (s > score) { score = s; best = a.id; }
  }
  return score >= Math.min(2, m.length) && score > 0 ? best : "";
}

export function AssignHeadDialog({ member, currentName, onClose, onDone }: { member: { id: number; name: string } | null; currentName: string | null; onClose: () => void; onDone: () => void }) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ id: number; name: string } | null>(null);
  if (member && member !== last) setLast(member); // keep the text while the dialog fades out

  useEffect(() => {
    if (!member) return;
    let off = false;
    (async () => {
      const [{ people }, { data: sup }] = await Promise.all([
        adminFetch<{ people: Account[] }>("/api/admin/people"),
        sb.from("admin_roles").select("user_id").eq("role", "super_admin"),
      ]);
      if (off) return;
      const skip = new Set((sup ?? []).map((r) => r.user_id)); // the super admin already can do everything a head can
      const list = people.filter((p) => !skip.has(p.id));
      setAccounts(list);
      setPick(guess(member.name, list));
    })().catch(() => { if (!off) setAccounts([]); });
    return () => { off = true; setAccounts(null); setPick(""); };
  }, [member]);

  const shownName = member?.name ?? last?.name ?? "";
  const options = useMemo(() => accounts ?? [], [accounts]);

  async function confirm() {
    if (!member || !pick) return;
    setBusy(true);
    const { error } = await sb.schema("public").rpc("set_media_head", { uid: pick, member: member.id });
    setBusy(false);
    if (error) { notify.error("Couldn't assign the media head.", { description: error.message }); return; }
    notify.created(member.name, { description: currentName && currentName !== member.name ? `Is now the media head, replacing ${currentName}.` : "Is now the media head." });
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
            <Dialog.Title className="font-display text-xl font-semibold text-white">Assign {shownName} as media head?</Dialog.Title>
            <Dialog.Description className="mt-3 text-sm leading-relaxed text-slate-400">
              When a competition is coming up, the media head is prompted to hand out the media tasks.{currentName && currentName !== shownName ? <> <span className="text-white">{currentName}</span> will no longer be media head.</> : null}
            </Dialog.Description>
            <label className="mt-5 block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">Which account does {shownName} use?</span>
              {accounts === null ? <span className="block h-11 animate-pulse rounded-xl bg-slate-800" aria-hidden="true" /> : (
                <select value={pick} onChange={(e) => setPick(e.target.value)} className="h-11 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 text-sm text-white outline-none! transition-colors hover:border-slate-500 focus-visible:border-accent">
                  <option value="">Choose an account…</option>
                  {options.map((a) => <option key={a.id} value={a.id}>{a.full_name || a.email}{a.full_name ? ` (${a.email})` : ""}</option>)}
                </select>
              )}
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

export async function clearMediaHead(name: string, reload: () => void) {
  const { error } = await sb.schema("public").rpc("clear_media_head");
  if (error) { notify.error("Couldn't remove the media head.", { description: error.message }); return; }
  notify.deleted(`${name} is no longer the media head`);
  reload();
}
