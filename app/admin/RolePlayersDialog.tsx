"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Tag, Users, X } from "lucide-react";
import { sb } from "./supabase";

type Holder = { memberId: number; seasonId: number; name: string; photo: string | null; graduated: boolean };
type Season = { id: number; name: string };

const initials = (n: string) => { const p = n.trim().split(/\s+/); return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?"; };

function Avatar({ name, src }: { name: string; src: string | null }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-600 bg-slate-800 font-display text-sm font-semibold text-slate-400">
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : initials(name)}
    </span>
  );
}

/* Opens when a role card is tapped: everyone who holds that role, newest season first. */
export default function RolePlayersDialog({ role, onClose }: { role: { id: number; name: string } | null; onClose: () => void }) {
  const [holders, setHolders] = useState<Holder[] | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!role) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHolders(null); setError("");
    (async () => {
      const [links, seasonRes] = await Promise.all([
        sb.from("member_roles").select("member_id, season_id").eq("role_id", role.id).limit(5000),
        sb.from("seasons").select("id, season_name").order("id", { ascending: false }),
      ]);
      if (cancelled) return;
      if (links.error) { setError(links.error.message); return; }
      const ids = [...new Set((links.data ?? []).map((l) => l.member_id as number))];
      const people = ids.length
        ? await sb.from("team_members").select("id, name, profile_image_url, is_graduated").in("id", ids)
        : { data: [], error: null };
      if (cancelled) return;
      if (people.error) { setError(people.error.message); return; }
      const byId = new Map((people.data ?? []).map((p) => [p.id as number, p]));
      setSeasons(((seasonRes.data ?? []) as { id: number; season_name: string | null }[]).map((s) => ({ id: s.id, name: s.season_name ?? `Season ${s.id}` })));
      setHolders(
        (links.data ?? [])
          .map((l) => {
            const p = byId.get(l.member_id as number);
            return p ? { memberId: p.id as number, seasonId: l.season_id as number, name: String(p.name), photo: (p.profile_image_url as string | null) ?? null, graduated: p.is_graduated === true } : null;
          })
          .filter((x): x is Holder => !!x)
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    })();
    return () => { cancelled = true; };
  }, [role]);

  const bySeason = seasons
    .map((s) => ({ season: s, list: (holders ?? []).filter((h) => h.seasonId === s.id) }))
    .filter((g) => g.list.length > 0);
  const unique = new Set((holders ?? []).map((h) => h.memberId)).size;

  return (
    <Dialog.Root open={role !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-start justify-items-center overflow-y-auto p-4 sm:place-items-center">
          <Dialog.Popup className="my-4 w-full max-w-xl rounded-2xl border border-slate-600 bg-slate-900 outline-none transition-[opacity,transform] duration-200 ease-out-quint data-[starting-style]:translate-y-2 data-[starting-style]:scale-[.97] data-[starting-style]:opacity-0 data-[ending-style]:scale-[.97] data-[ending-style]:opacity-0">
            <div className="flex items-start gap-4 p-6 pb-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent/40 bg-accent/10 text-accent"><Tag className="h-5 w-5" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <Dialog.Title className="break-words font-display text-xl font-semibold text-white">{role?.name}</Dialog.Title>
                <Dialog.Description className="mt-0.5 text-sm text-slate-400">
                  {holders === null && !error ? "Loading players…" : `${unique} ${unique === 1 ? "player" : "players"} hold this role`}
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" aria-hidden="true" /></Dialog.Close>
            </div>

            <div className="max-h-[65vh] overflow-y-auto px-6 pb-6">
              {error ? (
                <p role="alert" className="rounded-xl border border-[#ef4444]/40 p-3 text-sm text-[#f87171]">{error}</p>
              ) : holders === null ? (
                <div className="space-y-2" aria-hidden="true">{[...Array(4)].map((_, i) => <div key={i} className="h-[60px] animate-pulse rounded-xl border border-slate-700 bg-slate-800/50" style={{ animationDelay: `${i * 80}ms` }} />)}</div>
              ) : bySeason.length === 0 ? (
                <div className="grid place-items-center rounded-2xl border border-dashed border-slate-600 px-6 py-12 text-center">
                  <Users className="h-7 w-7 text-slate-500" aria-hidden="true" />
                  <p className="mt-3 font-medium text-white">No one holds this role yet</p>
                  <p className="mt-1 text-sm text-slate-400">Give it to a player when you add them to a team.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {bySeason.map(({ season, list }, gi) => (
                    <section key={season.id} style={{ animation: "rise .4s var(--ease) both", animationDelay: `${gi * 60}ms` }}>
                      <h3 className="mb-2 flex items-center gap-2 font-mono text-[.7rem] uppercase tracking-[.16em] text-slate-400">{season.name}<span className="rounded-full border border-slate-700 px-2 py-0.5 text-[.64rem] tabular-nums text-slate-500">{list.length}</span></h3>
                      <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
                        {list.map((h, i) => (
                          <li key={`${h.memberId}-${season.id}`} className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/40 p-2.5" style={{ animation: "rise .35s var(--ease) both", animationDelay: `${gi * 60 + Math.min(i, 8) * 30}ms` }}>
                            <Avatar name={h.name} src={h.photo} />
                            <span className="min-w-0 flex-1">
                              <span className="block break-words text-sm font-semibold text-white">{h.name}</span>
                              {h.graduated && <span className="block text-[.68rem] text-slate-500">Graduated</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
