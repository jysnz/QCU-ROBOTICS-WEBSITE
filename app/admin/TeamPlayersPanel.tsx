"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Switch } from "@base-ui/react/switch";
import { Tabs } from "@base-ui/react/tabs";
import NumberFlow from "@number-flow/react";
import { notify } from "./notify";
import { ChevronDown, Info, Loader2, Lock, Pencil, Plus, Search, Trash2, UserPlus, UserX, X } from "lucide-react";
import Dropdown from "../components/Dropdown";
import PhotoDropzone from "./PhotoDropzone";
import { sb } from "./supabase";

type Player = { id: number; name: string; profile_image_url: string | null; is_active: boolean | null; is_graduated: boolean | null };
type Team = { id: number; team_name: string; team_number: number; team_code: string | null; season_id: number | null };
type Season = { id: number; season_name: string | null; is_active: boolean };
type Assign = { id: number; member_id: number; team_id: number; season_id: number };
type MemberRole = { id: number; member_id: number; role_id: number; season_id: number };
type Role = { id: number; role_name: string };
type Data = { players: Player[]; teams: Team[]; seasons: Season[]; assigns: Assign[]; memberRoles: MemberRole[]; roles: Role[] };

const input = "h-11 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 text-sm font-medium text-white outline-none transition-[border-color,box-shadow] placeholder:text-slate-500 hover:border-slate-500 focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_rgba(200,245,96,.18)] focus-visible:outline-none";
const lbl = "mb-2 block font-mono text-[.7rem] font-medium uppercase tracking-[.16em] text-slate-400";

const teamLabel = (t: Team) => t.team_code || t.team_name || `Team ${t.team_number}`;
const initials = (n: string) => { const p = n.trim().split(/\s+/); return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?"; };

/* ───────── Player dialog: details, then (when editing) teams and roles in tabs ───────── */
function PlayerDialog({ playerId, ctx, open, data, onClose, onChanged, onCreated }: {
  playerId: number | "new" | null; ctx: Team | null; open: boolean; data: Data; onClose: () => void; onChanged: () => Promise<void>; onCreated: (id: number) => void;
}) {
  const player = typeof playerId === "number" ? data.players.find((p) => p.id === playerId) : undefined;
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState("");
  const [active, setActive] = useState(true);
  const [newTeam, setNewTeam] = useState(""); // required when adding: which team the player joins
  const [newRole, setNewRole] = useState(""); // required when adding: their role that season
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("details");
  const [teamPick, setTeamPick] = useState("");
  const [rolePick, setRolePick] = useState("");
  const [rolePickSeason, setRolePickSeason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  // load the form whenever a different player (or "new") is opened
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(player?.name ?? "");
    setPhoto(player?.profile_image_url ?? "");
    setActive(player ? player.is_active !== false : true);
    setNewTeam(""); setNewRole("");
    setErr(""); setTab("details"); setTeamPick(""); setRolePick(""); setRolePickSeason(""); setConfirmDelete(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [playerId, player?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const seasonName = (id: number | null) => data.seasons.find((s) => s.id === id)?.season_name ?? "";
  const mine = typeof playerId === "number" ? data.assigns.filter((a) => a.member_id === playerId) : [];
  const myRoles = typeof playerId === "number" ? data.memberRoles.filter((r) => r.member_id === playerId) : [];
  // New entries can only go into active seasons; past seasons stay as they were.
  const activeSeasonIds = new Set(data.seasons.filter((s) => s.is_active).map((s) => s.id));
  const activeTeams = data.teams.filter((t) => t.season_id !== null && activeSeasonIds.has(t.season_id));
  const freeTeams = activeTeams.filter((t) => !mine.some((a) => a.team_id === t.id));
  const sortedTeams = (list: Team[]) => [...list].sort((a, b) => (b.season_id ?? 0) - (a.season_id ?? 0) || a.team_number - b.team_number);

  async function save() {
    if (saving) return;
    if (!name.trim()) { setErr("Name is required."); return; }
    const team = data.teams.find((t) => String(t.id) === newTeam);
    if (playerId === "new") {
      if (!team || team.season_id === null) { setErr("Choose the team this player belongs to."); return; }
      if (!newRole) { setErr("Choose the player's role."); return; }
    }
    setSaving(true); setErr("");
    const base = { name: name.trim(), profile_image_url: photo || null, is_active: active };
    if (playerId === "new" && team && team.season_id !== null) {
      // new players always start as not graduated
      const { data: row, error } = await sb.from("team_members").insert({ ...base, is_graduated: false }).select("id").single();
      if (error) { setSaving(false); setErr(error.message); notify.error(`Couldn't save: ${error.message}`); return; }
      const a1 = await sb.from("member_team_seasons").insert({ member_id: row.id, team_id: team.id, season_id: team.season_id });
      const a2 = a1.error ? a1 : await sb.from("member_roles").insert({ member_id: row.id, role_id: Number(newRole), season_id: team.season_id });
      setSaving(false);
      await onChanged();
      if (a2.error) { notify.error(`${base.name} was added, but the team or role failed: ${a2.error.message}`); onCreated(row.id); return; }
      notify.created(`${base.name} added`, { description: `${teamLabel(team)} · ${data.roles.find((r) => String(r.id) === newRole)?.role_name ?? "player"}` });
      onClose();
    } else {
      const { error } = await sb.from("team_members").update(base).eq("id", playerId!);
      setSaving(false);
      if (error) { setErr(error.message); notify.error(`Couldn't save: ${error.message}`); return; }
      notify.updated("Player updated", { description: name.trim() });
      await onChanged();
    }
  }

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { notify.error(error.message); return false; }
    (/removed/i.test(ok) ? notify.deleted : /added|assigned/i.test(ok) ? notify.created : notify.updated)(ok);
    await onChanged();
    return true;
  }

  const addTeam = async () => {
    const t = data.teams.find((x) => String(x.id) === teamPick);
    if (!t || typeof playerId !== "number") return;
    if (graduated) { notify.error("Graduated players can't be assigned to a team."); return; }
    if (t.season_id === null) { notify.error("That team has no season set."); return; }
    if (await run(() => sb.from("member_team_seasons").insert({ member_id: playerId, team_id: t.id, season_id: t.season_id }), "Assigned to team")) setTeamPick("");
  };
  const addRole = async () => {
    if (!rolePick || !rolePickSeason || typeof playerId !== "number") return;
    if (graduated) { notify.error("Graduated players can't be given a role."); return; }
    if (await run(() => sb.from("member_roles").insert({ member_id: playerId, role_id: Number(rolePick), season_id: Number(rolePickSeason) }), "Role added")) { setRolePick(""); setRolePickSeason(""); }
  };

  async function deletePlayer() {
    if (typeof playerId !== "number") return;
    setBusy(true);
    const a = await sb.from("member_roles").delete().eq("member_id", playerId);
    const b = await sb.from("member_team_seasons").delete().eq("member_id", playerId);
    const c = a.error || b.error ? { error: a.error || b.error } : await sb.from("team_members").delete().eq("id", playerId);
    setBusy(false);
    if (c.error) { notify.error(`Couldn't delete: ${c.error.message}`); return; }
    notify.deleted("Player deleted", { description: player?.name });
    await onChanged();
    onClose();
  }

  // Opened from a team's roster: "delete" means take them off THAT team for THAT season. The player's record
  // and their other seasons stay untouched.
  async function removeFromRoster() {
    if (typeof playerId !== "number" || !ctx) return;
    setBusy(true);
    const a = await sb.from("member_team_seasons").delete().eq("member_id", playerId).eq("team_id", ctx.id);
    const b = ctx.season_id !== null && !a.error ? await sb.from("member_roles").delete().eq("member_id", playerId).eq("season_id", ctx.season_id) : { error: null };
    setBusy(false);
    const e = a.error || b.error;
    if (e) { notify.error(`Couldn't remove: ${e.message}`); return; }
    notify.deleted(`${player?.name ?? "Player"} removed from roster`, { description: `${teamLabel(ctx)}${ctx.season_id !== null ? ` · ${data.seasons.find((x) => x.id === ctx.season_id)?.season_name ?? "season"}` : ""}` });
    await onChanged();
    onClose();
  }

  const nameBad = !!err && !name.trim();
  const editing = typeof playerId === "number";
  const graduated = player?.is_graduated === true; // graduated players can't be put on teams or given roles

  const detailsForm = (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-5" noValidate>
      <div>
        <label className={lbl} htmlFor="tp-name">Full name <span className="text-accent">*</span></label>
        <div className="relative">
          <input
            id="tp-name"
            className={`${input} pr-10 ${nameBad ? "!border-[#f87171]" : ""}`}
            value={name}
            maxLength={80}
            onChange={(e) => { setName(e.target.value); if (err) setErr(""); }}
            placeholder="e.g. Juan Dela Cruz"
            autoComplete="off"
            autoFocus={playerId === "new"}
            aria-invalid={nameBad}
          />
          {name && <button type="button" onClick={() => setName("")} aria-label="Clear name" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:text-white"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>}
        </div>
      </div>

      <div>
        <span className={lbl}>Photo</span>
        <PhotoDropzone value={photo} onChange={setPhoto} name={name} folder="team_members" />
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3">
        <div>
          <p id="tp-active-label" className="text-sm font-medium text-white">Active</p>
          <p className="text-xs text-slate-500">Currently part of the team</p>
        </div>
        <Switch.Root
          checked={active}
          onCheckedChange={setActive}
          aria-labelledby="tp-active-label"
          className="relative inline-flex h-6 w-11 shrink-0 items-center cursor-pointer rounded-full border border-slate-600 bg-slate-800 outline-none transition-colors duration-200 focus-visible:shadow-[0_0_0_3px_rgba(200,245,96,.25)] data-[checked]:border-accent data-[checked]:bg-accent"
        >
          <Switch.Thumb className="block h-[18px] w-[18px] translate-x-[3px] rounded-full bg-slate-300 transition-transform duration-200 ease-out-quint data-[checked]:translate-x-[22px] data-[checked]:bg-accent-ink" />
        </Switch.Root>
      </div>

      {playerId === "new" && (
        activeTeams.length === 0 ? (
          <p className="flex gap-3 rounded-xl border border-[#fbbf24]/40 bg-[#fbbf24]/5 p-3 text-sm text-slate-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#fbbf24]" aria-hidden="true" />
            There&rsquo;s no team in an active season to add this player to. Add a team (Competitions → Teams) and mark its season active first.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={lbl} htmlFor="tp-team">Team <span className="text-accent">*</span></label>
              <select id="tp-team" value={newTeam} onChange={(e) => { setNewTeam(e.target.value); if (err) setErr(""); }} className={`${input} ${err && !newTeam ? "!border-[#f87171]" : ""}`} aria-invalid={!!err && !newTeam}>
                <option value="">Choose a team…</option>
                {sortedTeams(activeTeams).map((t) => <option key={t.id} value={t.id}>{teamLabel(t)} · {seasonName(t.season_id) || "no season"}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl} htmlFor="tp-role">Role <span className="text-accent">*</span></label>
              <select id="tp-role" value={newRole} onChange={(e) => { setNewRole(e.target.value); if (err) setErr(""); }} className={`${input} ${err && !newRole ? "!border-[#f87171]" : ""}`} aria-invalid={!!err && !newRole}>
                <option value="">Choose a role…</option>
                {data.roles.map((r) => <option key={r.id} value={r.id}>{r.role_name}</option>)}
              </select>
            </div>
          </div>
        )
      )}

      {err && <p role="alert" className="animate-fadeIn text-sm text-[#f87171]">{err}</p>}

      <div className="flex items-center justify-between gap-3 border-t border-slate-700 pt-5">
        {editing ? (
          confirmDelete ? (
            <div className="animate-fadeIn flex flex-1 flex-wrap items-center gap-3">
              <p className="text-sm text-slate-300">
                {ctx
                  ? <>Remove {player?.name} from <span className="text-white">{teamLabel(ctx)}</span>{seasonName(ctx.season_id) ? <> in <span className="text-white">{seasonName(ctx.season_id)}</span></> : null}? Their other seasons and player record stay.</>
                  : "Delete this player and all their entries?"}
              </p>
              <button type="button" onClick={() => setConfirmDelete(false)} className="btn btn-ghost btn-sm">Keep</button>
              <button type="button" disabled={busy} onClick={ctx ? removeFromRoster : deletePlayer} className="btn btn-sm bg-[#ef4444] text-white hover:bg-[#f87171]">{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}{ctx ? "Remove" : "Delete"}</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-[#f87171]"><Trash2 className="h-4 w-4" aria-hidden="true" /> {ctx ? `Remove from ${teamLabel(ctx)}${seasonName(ctx.season_id) ? ` · ${seasonName(ctx.season_id)}` : ""}` : "Delete player"}</button>
          )
        ) : <span />}
        {!confirmDelete && (
          <div className="flex gap-3">
            <Dialog.Close className="btn btn-ghost btn-sm" disabled={saving}>{editing ? "Close" : "Cancel"}</Dialog.Close>
            <button type="submit" disabled={saving || (playerId === "new" && activeTeams.length === 0)} className="btn btn-primary btn-sm min-w-28 disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {editing ? "Save changes" : "Add player"}
            </button>
          </div>
        )}
      </div>
    </form>
  );

  const rowCls = "flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2.5 text-sm";
  const trash = "grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-[#f87171] disabled:opacity-50";

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o && !saving && !busy) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-start justify-items-center overflow-y-auto p-4 sm:place-items-center">
          <Dialog.Popup className="my-4 w-full max-w-2xl rounded-2xl border border-slate-600 bg-slate-900 outline-none transition-[opacity,transform] duration-200 ease-out-quint data-[starting-style]:translate-y-2 data-[starting-style]:scale-[.97] data-[starting-style]:opacity-0 data-[ending-style]:scale-[.97] data-[ending-style]:opacity-0">
            <div className="flex items-start gap-4 p-6 pb-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent/40 bg-accent/10 text-accent">
                {playerId === "new" ? <UserPlus className="h-5 w-5" aria-hidden="true" /> : <Pencil className="h-5 w-5" aria-hidden="true" />}
              </span>
              <div className="min-w-0 flex-1">
                <Dialog.Title className="truncate font-display text-xl font-semibold text-white">{playerId === "new" ? "Add team player" : player?.name ?? "Player"}</Dialog.Title>
                <Dialog.Description className="mt-0.5 text-sm text-slate-400">
                  {playerId === "new" ? "Add the player, the team they belong to and their role." : "Update details, teams and roles."}
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" aria-hidden="true" /></Dialog.Close>
            </div>

            {!editing ? (
              <div className="px-6 pb-6">{detailsForm}</div>
            ) : (
              <Tabs.Root value={tab} onValueChange={(v) => setTab(String(v))}>
                <Tabs.List aria-label="Player sections" className="relative mx-6 flex gap-1 border-b border-slate-700">
                  {([["details", "Details"], ["teams", `Teams & seasons`, mine.length], ["roles", "Roles", myRoles.length]] as const).map(([v, label, n]) => (
                    <Tabs.Tab key={v} value={v} className="relative z-10 -mb-px h-11 cursor-pointer px-4 text-sm font-semibold text-slate-400 outline-none transition-colors hover:text-white focus-visible:text-white data-[active]:text-white">
                      {label}{typeof n === "number" && <span className="ml-2 rounded-full border border-slate-600 px-1.5 py-0.5 font-mono text-[.65rem] text-slate-400">{n}</span>}
                    </Tabs.Tab>
                  ))}
                  <Tabs.Indicator className="absolute bottom-0 left-0 h-0.5 w-[var(--active-tab-width)] translate-x-[var(--active-tab-left)] rounded-full bg-accent transition-[translate,width] duration-300 ease-out-quint" />
                </Tabs.List>

                <Tabs.Panel value="details" className="animate-fadeIn p-6 outline-none">{detailsForm}</Tabs.Panel>

                <Tabs.Panel value="teams" className="animate-fadeIn p-6 outline-none">
                  <p className="text-sm text-slate-400">A player who played in several seasons has one entry per season.</p>
                  <ul className="mt-4 space-y-2">
                    {mine.length === 0 && <li className="rounded-xl border border-dashed border-slate-600 py-6 text-center text-sm text-slate-500">Not on any team yet.</li>}
                    {[...mine].sort((a, b) => b.season_id - a.season_id).map((a) => {
                      const t = data.teams.find((x) => x.id === a.team_id);
                      return (
                        <li key={a.id} className={rowCls}>
                          <span className="flex-1 text-white">{t ? teamLabel(t) : `Team #${a.team_id}`}<span className="ml-2 text-slate-400">· {seasonName(a.season_id) || `Season ${a.season_id}`}</span></span>
                          <button type="button" disabled={busy} aria-label="Remove from team" onClick={() => run(() => sb.from("member_team_seasons").delete().eq("id", a.id), "Removed from team")} className={trash}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                        </li>
                      );
                    })}
                  </ul>
                  {graduated ? (
                    <p className="mt-4 flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-400"><Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> This player has graduated, so they can&rsquo;t be added to a team. Existing entries can still be removed.</p>
                  ) : (
                  <div className="mt-4 flex gap-2">
                    <select aria-label="Team" value={teamPick} onChange={(e) => setTeamPick(e.target.value)} className={input}>
                      <option value="">Add to a team…</option>
                      {sortedTeams(freeTeams).map((t) => <option key={t.id} value={t.id}>{teamLabel(t)} · {seasonName(t.season_id) || "no season"}</option>)}
                    </select>
                    <button type="button" disabled={!teamPick || busy} onClick={addTeam} className="btn btn-primary btn-sm shrink-0 disabled:opacity-50"><Plus className="h-4 w-4" aria-hidden="true" /> Add</button>
                  </div>
                  )}
                </Tabs.Panel>

                <Tabs.Panel value="roles" className="animate-fadeIn p-6 outline-none">
                  <p className="text-sm text-slate-400">Roles are per season, so the same player can be a builder one year and captain the next.</p>
                  <ul className="mt-4 space-y-2">
                    {myRoles.length === 0 && <li className="rounded-xl border border-dashed border-slate-600 py-6 text-center text-sm text-slate-500">No roles yet.</li>}
                    {myRoles.map((r) => (
                      <li key={r.id} className={rowCls}>
                        <span className="flex-1 text-white">{data.roles.find((x) => x.id === r.role_id)?.role_name ?? `Role #${r.role_id}`}<span className="ml-2 text-slate-400">· {seasonName(r.season_id) || `Season ${r.season_id}`}</span></span>
                        <button type="button" disabled={busy} aria-label="Remove role" onClick={() => run(() => sb.from("member_roles").delete().eq("id", r.id), "Role removed")} className={trash}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                      </li>
                    ))}
                  </ul>
                  {graduated ? (
                    <p className="mt-4 flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-400"><Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> This player has graduated, so they can&rsquo;t be given a role. Existing roles can still be removed.</p>
                  ) : (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <select aria-label="Role" value={rolePick} onChange={(e) => setRolePick(e.target.value)} className={input}>
                      <option value="">Role…</option>
                      {data.roles.map((r) => <option key={r.id} value={r.id}>{r.role_name}</option>)}
                    </select>
                    <select aria-label="Season" value={rolePickSeason} onChange={(e) => setRolePickSeason(e.target.value)} className={input}>
                      <option value="">Season…</option>
                      {[...data.seasons].filter((s) => s.is_active).sort((a, b) => b.id - a.id).map((s) => <option key={s.id} value={s.id}>{s.season_name}</option>)}
                    </select>
                    <button type="button" disabled={!rolePick || !rolePickSeason || busy} onClick={addRole} className="btn btn-primary btn-sm shrink-0 disabled:opacity-50"><Plus className="h-4 w-4" aria-hidden="true" /> Add</button>
                  </div>
                  )}
                </Tabs.Panel>
              </Tabs.Root>
            )}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ───────── Card ───────── */
function PlayerCard({ p, roles, otherSeasons, duplicate, delay, onEdit }: {
  p: Player; roles: string[]; otherSeasons: string[]; duplicate: boolean; delay: number; onEdit: () => void;
}) {
  const [broken, setBroken] = useState(false);
  // One fixed line for the small print so every card is the same height, whatever the player has.
  const meta = [
    p.is_active === false ? "Inactive" : "",
    p.is_graduated ? "Graduated" : "",
    otherSeasons.length > 0 ? `Also: ${otherSeasons.join(", ")}` : "",
  ].filter(Boolean).join(" · ") || " ";
  return (
    <li className="h-full" style={{ animation: "rise .5s var(--ease) both", animationDelay: `${delay}ms` }}>
      <button type="button" onClick={onEdit} className="lift group relative flex h-[5.5rem] w-full items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 p-3 text-left hover:border-slate-500">
        <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-600 bg-slate-800 font-display text-base font-semibold text-slate-400">
          {p.profile_image_url && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.profile_image_url} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
          ) : initials(p.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-white">{p.name}</span>
            {duplicate && <span title="Another player entry has this exact name" className="shrink-0 rounded-md border border-[#fbbf24]/50 px-1.5 py-0.5 font-mono text-[.58rem] uppercase tracking-[.12em] text-[#fbbf24]">Same name</span>}
          </span>
          <span className="mt-0.5 block truncate font-mono text-[.68rem] uppercase tracking-[.1em] text-accent">{roles.length ? roles.join(" · ") : "Player"}</span>
          <span className="mt-1 block h-4 truncate text-[.7rem] leading-4 text-slate-500" title={meta}>{meta}</span>
        </span>
        <Pencil className="h-4 w-4 shrink-0 text-slate-600 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
      </button>
    </li>
  );
}

/* ───────── Panel ───────── */
export default function TeamPlayersPanel({ startNew = false, embedded = false }: { startNew?: boolean; embedded?: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [season, setSeason] = useState("all");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [dialog, setDialog] = useState<number | "new" | null>(startNew ? "new" : null);
  const [dialogTeam, setDialogTeam] = useState<Team | null>(null); // the team whose roster the open player came from

  const load = useCallback(async () => {
    let seasonRes = await sb.from("seasons").select("id, season_name, is_active").order("id", { ascending: false });
    let noActiveColumn = false;
    if (seasonRes.error && (seasonRes.error.code === "42703" || /is_active/.test(seasonRes.error.message))) {
      noActiveColumn = true; // supabase/season-active.sql hasn't been run: the newest season counts as the active one
      seasonRes = (await sb.from("seasons").select("id, season_name").order("id", { ascending: false })) as typeof seasonRes;
    }
    const [players, teams, assigns, memberRoles, roles] = await Promise.all([
      sb.from("team_members").select("id, name, profile_image_url, is_active, is_graduated").order("name").limit(5000),
      sb.from("teams").select("id, team_name, team_number, team_code, season_id").limit(2000),
      sb.from("member_team_seasons").select("id, member_id, team_id, season_id").limit(10000),
      sb.from("member_roles").select("id, member_id, role_id, season_id").limit(10000),
      sb.from("roles").select("id, role_name").order("role_name"),
    ]);
    const failed = [seasonRes, players, teams, assigns, memberRoles, roles].find((r) => r.error);
    if (failed?.error) { setError(failed.error.message); return; }
    setError("");
    setData({
      players: (players.data ?? []) as Player[], teams: (teams.data ?? []) as Team[], seasons: ((seasonRes.data ?? []) as { id: number; season_name: string | null; is_active?: boolean }[]).map((x, i) => ({ id: x.id, season_name: x.season_name, is_active: noActiveColumn ? i === 0 : x.is_active === true })),
      assigns: (assigns.data ?? []) as Assign[], memberRoles: (memberRoles.data ?? []) as MemberRole[], roles: (roles.data ?? []) as Role[],
    });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const view = useMemo(() => {
    if (!data) return null;
    const seasonName = (id: number | null) => data.seasons.find((s) => s.id === id)?.season_name ?? `Season ${id}`;
    const order = new Map(data.seasons.map((s, i) => [s.id, i])); // seasons arrive newest first
    const playerById = new Map(data.players.map((p) => [p.id, p]));
    const q = query.trim().toLowerCase();

    const nameCount = new Map<string, number>();
    for (const p of data.players) { const k = p.name.trim().toLowerCase(); nameCount.set(k, (nameCount.get(k) ?? 0) + 1); }

    const teams = data.teams
      .filter((t) => season === "all" || String(t.season_id) === season)
      .sort((a, b) => (order.get(a.season_id ?? -1) ?? 999) - (order.get(b.season_id ?? -1) ?? 999) || a.team_number - b.team_number);

    const groups = teams.map((t) => {
      const ids = [...new Set(data.assigns.filter((a) => a.team_id === t.id).map((a) => a.member_id))];
      const members = ids.map((id) => playerById.get(id)).filter((p): p is Player => !!p && (!q || p.name.toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name));
      return { team: t, seasonName: seasonName(t.season_id), members, total: ids.length };
    }).filter((g) => (q ? g.members.length > 0 : true));

    const assignedIds = new Set(data.assigns.map((a) => a.member_id));
    const unassigned = season === "all" ? data.players.filter((p) => !assignedIds.has(p.id) && (!q || p.name.toLowerCase().includes(q))) : [];

    const playersIn = new Set(groups.flatMap((g) => g.members.map((m) => m.id)));
    return { groups, unassigned, seasonName, nameCount, uniquePlayers: playersIn.size + unassigned.length };
  }, [data, season, query]);

  const rolesFor = (memberId: number, seasonId: number | null) =>
    (data?.memberRoles ?? []).filter((r) => r.member_id === memberId && r.season_id === seasonId).map((r) => data!.roles.find((x) => x.id === r.role_id)?.role_name ?? "").filter(Boolean);
  const otherSeasonsFor = (memberId: number, seasonId: number | null) =>
    [...new Set((data?.assigns ?? []).filter((a) => a.member_id === memberId && a.season_id !== seasonId).map((a) => a.season_id))]
      .sort((a, b) => b - a).map((id) => view!.seasonName(id));

  const toggle = (id: number) => setCollapsed((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; });
  const allIds = view?.groups.map((g) => g.team.id) ?? [];
  const allCollapsed = allIds.length > 0 && allIds.every((id) => collapsed.has(id));

  return (
    <section aria-labelledby="panel-title">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          {!embedded && <h1 id="panel-title" className="font-display text-3xl font-bold tracking-[-0.03em] text-white">Team players</h1>}
          <p className={embedded ? "text-sm text-slate-400" : "mt-2 text-slate-400"}>Players grouped by team. Someone who played in several seasons appears under each team, labelled with the season.</p>
        </div>
        <button type="button" onClick={() => { setDialogTeam(null); setDialog("new"); }} className="btn btn-primary shrink-0"><Plus className="h-4 w-4" aria-hidden="true" /> Add team player</button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-[14rem_1fr_auto] md:items-end">
        <Dropdown
          label="Season"
          items={[{ label: "All seasons", value: "all" }, ...(data?.seasons ?? []).map((s) => ({ label: String(s.season_name), value: String(s.id) }))]}
          value={season}
          onValueChange={setSeason}
          disabled={!data}
        />
        <label className="relative block">
          <span className="sr-only">Search players</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search players" className={`${input} h-12 pl-11`} />
        </label>
        <dl className="flex gap-3">
          <div className="min-w-20 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2"><dt className="text-xs text-slate-400">Players</dt><dd className="font-display text-xl font-bold tabular-nums text-white"><NumberFlow value={view?.uniquePlayers ?? 0} /></dd></div>
          <div className="min-w-20 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2"><dt className="text-xs text-slate-400">Teams</dt><dd className="font-display text-xl font-bold tabular-nums text-white"><NumberFlow value={view?.groups.length ?? 0} /></dd></div>
        </dl>
      </div>

      {error && <p role="alert" className="mb-5 rounded-xl border border-[#ef4444]/40 p-3 text-sm text-[#f87171]">{error}</p>}

      {!view ? (
        <div className="space-y-8" aria-hidden="true">
          {[...Array(2)].map((_, i) => (
            <div key={i}>
              <div className="mb-4 h-6 w-48 animate-pulse rounded bg-slate-800" />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[...Array(3)].map((__, j) => <div key={j} className="h-20 animate-pulse rounded-xl border border-slate-700 bg-slate-900" />)}</div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {view.groups.length > 0 && (
            <div className="mb-4 flex justify-end">
              <button type="button" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(allIds))} className="text-sm font-medium text-slate-300 underline-offset-4 transition-colors hover:text-white hover:underline">
                {allCollapsed ? "Show all teams" : "Hide all teams"}
              </button>
            </div>
          )}

          <div key={`${season}-${query ? "q" : ""}`} className="space-y-4">
            {view.groups.map((g, gi) => {
              const open = !collapsed.has(g.team.id);
              return (
                <section key={g.team.id} className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/40" style={{ animation: "rise .5s var(--ease) both", animationDelay: `${Math.min(gi, 6) * 60}ms` }}>
                  <button type="button" onClick={() => toggle(g.team.id)} aria-expanded={open} aria-controls={`tp-${g.team.id}`} className="group flex w-full items-center gap-4 px-5 py-4 text-left outline-none focus-visible:bg-slate-900/60">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-600 bg-slate-900 font-mono text-xs font-semibold text-accent">{g.team.team_number}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-lg font-semibold text-white">{teamLabel(g.team)}{g.team.team_name && g.team.team_code ? <span className="ml-2 text-sm font-normal text-slate-400">{g.team.team_name}</span> : null}</span>
                      <span className="block font-mono text-[.7rem] uppercase tracking-[.14em] text-slate-400">{g.seasonName}</span>
                    </span>
                    <span className="rounded-full border border-slate-600 px-3 py-1 font-mono text-xs tabular-nums text-slate-300">{g.total} {g.total === 1 ? "player" : "players"}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 ease-out-quint group-hover:text-white ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  <div id={`tp-${g.team.id}`} inert={!open} className={`grid transition-[grid-template-rows] duration-300 ease-out-quint ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <div className="min-h-0 overflow-hidden">
                      <div className="border-t border-slate-700 p-4">
                        {g.members.length === 0 ? (
                          <p className="py-4 text-center text-sm text-slate-500">No players on this team yet.</p>
                        ) : (
                          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {g.members.map((p, i) => (
                              <PlayerCard
                                key={p.id}
                                p={p}
                                roles={rolesFor(p.id, g.team.season_id)}
                                otherSeasons={season === "all" ? otherSeasonsFor(p.id, g.team.season_id) : []}
                                duplicate={(view.nameCount.get(p.name.trim().toLowerCase()) ?? 0) > 1}
                                delay={Math.min(i, 9) * 35}
                                onEdit={() => { setDialogTeam(g.team); setDialog(p.id); }}
                              />
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}

            {view.unassigned.length > 0 && (
              <section className="rounded-2xl border border-dashed border-slate-600 p-5" style={{ animation: "rise .5s var(--ease) both" }}>
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white"><UserX className="h-4 w-4 text-slate-400" aria-hidden="true" /> Not on a team <span className="font-mono text-xs font-normal text-slate-400">{view.unassigned.length}</span></h2>
                <p className="mt-1 text-sm text-slate-400">These players aren&rsquo;t assigned to any team, so they don&rsquo;t show on the site. Open one to assign a team.</p>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {view.unassigned.map((p, i) => (
                    <PlayerCard key={p.id} p={p} roles={[]} otherSeasons={[]} duplicate={(view.nameCount.get(p.name.trim().toLowerCase()) ?? 0) > 1} delay={Math.min(i, 9) * 35} onEdit={() => { setDialogTeam(null); setDialog(p.id); }} />
                  ))}
                </ul>
              </section>
            )}

            {view.groups.length === 0 && view.unassigned.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-600 py-14 text-center text-sm text-slate-400">
                {query ? "No players match that search." : "No teams or players for this season yet."}
              </p>
            )}
          </div>
        </>
      )}

      {data && (
        <PlayerDialog
          playerId={dialog}
          ctx={dialogTeam}
          open={dialog !== null}
          data={data}
          onClose={() => setDialog(null)}
          onChanged={load}
          onCreated={(id) => setDialog(id)}
        />
      )}
    </section>
  );
}
