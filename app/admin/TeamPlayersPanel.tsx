"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog } from "@base-ui/react/dialog";
import { Switch } from "@base-ui/react/switch";
import { Tabs } from "@base-ui/react/tabs";
import NumberFlow from "@number-flow/react";
import { notify } from "./notify";
import { Camera, Check, ChevronDown, Info, LayoutGrid, List, Loader2, Lock, Pencil, Plus, Search, Trash2, UserPlus, UserX, X } from "lucide-react";
import Dropdown from "../components/Dropdown";
import PhotoDropzone from "./PhotoDropzone";
import { sb } from "./supabase";
import { cached, peek, bustContent } from "./cache";

type Player = { id: number; name: string; profile_image_url: string | null; is_active: boolean | null; is_graduated: boolean | null };
type Team = { id: number; team_name: string; team_number: number; team_code: string | null; season_id: number | null };
type Season = { id: number; season_name: string | null; is_active: boolean };
type Assign = { id: number; member_id: number; team_id: number; season_id: number };
type MemberRole = { id: number; member_id: number; role_id: number; season_id: number };
type Role = { id: number; role_name: string };
type Reg = { id: number; name: string; image_url: string | null; is_active: boolean | null }; // a registered member of the site
type Media = { id: number; name: string; position: string | null; image_url: string | null; is_active: boolean | null }; // a media team member
type Data = { players: Player[]; teams: Team[]; seasons: Season[]; assigns: Assign[]; memberRoles: MemberRole[]; roles: Role[]; members: Reg[]; media: Media[] };
/** Someone who can be picked when adding a team player. */
type Cand = { key: string; kind: "player" | "media" | "member"; id: number; name: string; photo: string | null; meta: string; blocked?: string };

const input = "h-11 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 text-sm font-medium text-white outline-none transition-[border-color,box-shadow] placeholder:text-slate-500 hover:border-slate-500 focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_rgba(200,245,96,.18)] focus-visible:outline-none";
const lbl = "mb-2 block font-mono text-[.7rem] font-medium uppercase tracking-[.16em] text-slate-400";

const teamLabel = (t: Team) => t.team_code || t.team_name || `Team ${t.team_number}`;
const initials = (n: string) => { const p = n.trim().split(/\s+/); return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?"; };

/* ───────── Pick an existing person: search, then choose ───────── */
function Face({ name, src }: { name: string; src: string | null }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-600 bg-slate-800 font-display text-sm font-semibold text-slate-400">
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : initials(name)}
    </span>
  );
}

const SHOW = 50;
function PersonPicker({ cands, value, onChange, onNew }: { cands: Cand[]; value: Cand | null; onChange: (c: Cand | null) => void; onNew: (name: string) => void }) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? cands.filter((c) => c.name.toLowerCase().includes(s)) : cands;
  }, [cands, q]);
  const list = matches.slice(0, SHOW);

  if (value) {
    return (
      <div className="tk-rise flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/[.06] p-3">
        <Face name={value.name} src={value.photo} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{value.name}</span>
          <span className="block truncate text-xs text-slate-400">{value.meta}</span>
        </span>
        <button type="button" onClick={() => { onChange(null); setQ(""); }} className="btn btn-ghost btn-sm shrink-0">Change</button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault(); // Enter picks the top result instead of submitting the form
            const first = list.find((c) => !c.blocked);
            if (first) onChange(first);
          }}
          placeholder="Search players, media team and members"
          aria-label="Search people"
          autoComplete="off"
          autoFocus
          className={`${input} pl-11`}
        />
      </div>
      {/* the list takes only the height the window can spare, so the whole dialog stays in one frame */}
      <ul className="mt-2 max-h-[min(15rem,32vh)] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/50 p-1.5" aria-label="People">
        {list.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-slate-500">
            {cands.length === 0 ? "No one to choose from yet." : <>No one matches &ldquo;{q.trim()}&rdquo;.</>}
            {q.trim() && <button type="button" onClick={() => onNew(q.trim())} className="mt-3 block w-full text-sm font-medium text-accent hover:underline">Add &ldquo;{q.trim()}&rdquo; as a new person</button>}
          </li>
        )}
        {list.map((c, i) => (
          <li key={c.key}>
            {(i === 0 || list[i - 1].kind !== c.kind) && <p className="px-3 pb-1 pt-2 font-mono text-[.62rem] uppercase tracking-[.16em] text-slate-500">{c.kind === "player" ? "Players" : c.kind === "media" ? "Media team" : "Members"}</p>}
            <button
              type="button"
              disabled={!!c.blocked}
              onClick={() => onChange(c)}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors enabled:hover:bg-slate-800/70 enabled:focus-visible:bg-slate-800/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Face name={c.name} src={c.photo} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-white">{c.name}</span>
                <span className="block truncate text-xs text-slate-500">{c.blocked ?? c.meta}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {matches.length > SHOW && <p className="mt-2 text-xs text-slate-500">Showing {SHOW} of {matches.length}. Keep typing to narrow it down.</p>}
    </div>
  );
}

/* ───────── Player dialog: details, then (when editing) teams and roles in tabs ───────── */
function PlayerDialog({ playerId, ctx, open, data, onClose, onChanged, onCreated }: {
  playerId: number | "new" | null; ctx: Team | null; open: boolean; data: Data; onClose: () => void; onChanged: () => Promise<void>; onCreated: (id: number) => void;
}) {
  const player = typeof playerId === "number" ? data.players.find((p) => p.id === playerId) : undefined;
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState("");
  const [active, setActive] = useState(true);
  const [gradState, setGradState] = useState(false); // the Graduated switch, saved with "Save changes"
  const [newTeam, setNewTeam] = useState(""); // required when adding: which team the player joins
  const [newRoles, setNewRoles] = useState<string[]>([]); // required when adding: their role(s) that season, one or more
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("details");
  const [teamPick, setTeamPick] = useState("");
  const [rolePick, setRolePick] = useState("");
  const [rolePickSeason, setRolePickSeason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing"); // adding: pick someone who's already in the system, or add a new person
  const [chosen, setChosen] = useState<Cand[]>([]); // the people picked to join the team
  const [another, setAnother] = useState(false); // "Add another team player": stay open after assigning
  const [again, setAgain] = useState(0); // bumps after each assign so the name box is fresh and focused

  // load the form whenever a different player (or "new") is opened
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(player?.name ?? "");
    setPhoto(player?.profile_image_url ?? "");
    setActive(player ? player.is_active !== false : true);
    setGradState(player?.is_graduated === true);
    setNewTeam(playerId === "new" && ctx ? String(ctx.id) : ""); setNewRoles([]); setMode("existing"); setChosen([]); setAnother(false);
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
  // People who can be picked: players already in the system, then registered members who aren't players yet.
  const cands = useMemo<Cand[]>(() => {
    const teamId = Number(newTeam) || null;
    const byName = (a: Cand, b: Cand) => a.name.localeCompare(b.name);
    const players: Cand[] = data.players.filter((pl) => !pl.is_graduated).map((pl) => { // graduated players can't join a team, so they aren't offered
      const seasons = [...new Set(data.assigns.filter((a) => a.member_id === pl.id).map((a) => a.season_id))].sort((a, b) => b - a).map((id) => data.seasons.find((x) => x.id === id)?.season_name ?? "").filter(Boolean);
      const blocked = teamId !== null && data.assigns.some((a) => a.member_id === pl.id && a.team_id === teamId) ? "Already on this team" : undefined;
      return { key: `p${pl.id}`, kind: "player" as const, id: pl.id, name: pl.name, photo: pl.profile_image_url, meta: `${seasons.length ? `Played ${seasons.slice(0, 2).join(" · ")}` : "Not on a team yet"}${pl.is_active === false ? " · Inactive" : ""}`, blocked };
    }).sort(byName);
    // Media team and members can be assigned as players too. Anyone already a player is listed once, under Players.
    const known = new Set(data.players.map((pl) => pl.name.trim().toLowerCase()));
    const norm = (n: string) => n.trim().toLowerCase();
    const media: Cand[] = data.media
      .filter((m) => m.name?.trim() && !known.has(norm(m.name)))
      .map((m) => ({ key: `t${m.id}`, kind: "media" as const, id: m.id, name: m.name, photo: m.image_url, meta: `Media team${m.position?.trim() ? ` · ${m.position.trim()}` : ""}${m.is_active === false ? " · Inactive" : ""}` }))
      .sort(byName);
    const mediaNames = new Set(media.map((m) => norm(m.name)));
    const regs: Cand[] = data.members
      .filter((m) => m.name?.trim() && !known.has(norm(m.name)) && !mediaNames.has(norm(m.name)))
      .map((m) => ({ key: `m${m.id}`, kind: "member" as const, id: m.id, name: m.name, photo: m.image_url, meta: `Member${m.is_active === false ? " · Inactive" : ""}` }))
      .sort(byName);
    return [...players, ...media, ...regs];
  }, [data, newTeam]);

  const sortedTeams = (list: Team[]) => [...list].sort((a, b) => (b.season_id ?? 0) - (a.season_id ?? 0) || a.team_number - b.team_number);

  async function save() {
    if (saving) return;
    const adding = playerId === "new";
    const existing = adding && mode === "existing";
    const team = data.teams.find((t) => String(t.id) === newTeam);
    if (existing && chosen.length === 0) { setErr("Choose who is joining, or switch to New person."); return; }
    if (!existing && !name.trim()) { setErr("Name is required."); return; }
    if (adding) {
      if (!team || team.season_id === null) { setErr("Choose the team this player belongs to."); return; }
      if (!newRoles.length) { setErr("Choose at least one role."); return; }
      if (existing) {
        const dupes = chosen.filter((c) => c.kind === "player" && data.assigns.some((a) => a.member_id === c.id && a.team_id === team.id));
        if (dupes.length) { setErr(`${dupes.map((d) => d.name).join(", ")} ${dupes.length === 1 ? "is" : "are"} already on that team.`); return; }
      }
    }
    setSaving(true); setErr("");
    if (adding && team && team.season_id !== null) {
      // Several people can join at once; each is handled on its own so one failure doesn't undo the rest.
      const people: Cand[] = existing ? chosen : [{ key: "new", kind: "member", id: 0, name: name.trim(), photo: photo || null, meta: "" }];
      const done: Cand[] = [];
      const failed: string[] = [];
      let lastId = 0;
      for (const c of people) {
        let memberId: number;
        if (existing && c.kind === "player") {
          // someone already in the system: reuse their record instead of making a duplicate
          memberId = c.id;
          if (data.players.find((x) => x.id === memberId)?.is_active === false) await sb.from("team_members").update({ is_active: true }).eq("id", memberId); // joining a team makes them active again
        } else {
          // a new person, or a media team member / member becoming a player (new players always start as not graduated)
          const { data: row, error } = await sb.from("team_members").insert({ name: c.name, profile_image_url: c.photo, is_active: existing ? true : active, is_graduated: false }).select("id").single();
          if (error) { failed.push(`${c.name}: ${error.message}`); continue; }
          memberId = row.id;
        }
        lastId = memberId;
        const a1 = await sb.from("member_team_seasons").insert({ member_id: memberId, team_id: team.id, season_id: team.season_id });
        const a2 = a1.error ? a1 : await sb.from("member_roles").insert(newRoles.map((id) => ({ member_id: memberId, role_id: Number(id), season_id: team.season_id! })));
        if (a2.error) failed.push(`${c.name}: the team or role failed (${a2.error.message})`);
        else done.push(c);
      }
      setSaving(false);
      await onChanged();
      const where = `${teamLabel(team)} · ${newRoles.map((id) => data.roles.find((r) => String(r.id) === id)?.role_name).filter(Boolean).join(" + ") || "player"}`;
      if (done.length === 1) notify.created(`${done[0].name} assigned`, { description: where });
      else if (done.length > 1) notify.created(`${done.length} players assigned`, { description: `${where} · ${done.slice(0, 3).map((d) => d.name).join(", ")}${done.length > 3 ? ` +${done.length - 3}` : ""}` });
      if (failed.length) {
        notify.error(`${failed.length} couldn't be assigned`, { description: failed.slice(0, 2).join(" · ") });
        setErr(failed.join(" · "));
        if (existing) setChosen((cur) => cur.filter((c) => !done.some((d) => d.key === c.key))); // keep just the ones that still need doing
        else if (lastId) onCreated(lastId);
        return;
      }
      if (another) {
        // keep the team (the next person is probably joining it too); clear the person and their roles
        setChosen([]); setNewRoles([]); setName(""); setPhoto(""); setActive(true); setErr(""); setAgain((n) => n + 1);
        return;
      }
      onClose();
    } else {
      const base = { name: name.trim(), profile_image_url: photo || null, is_active: active, is_graduated: gradState };
      const { error } = await sb.from("team_members").update(base).eq("id", playerId!);
      setSaving(false);
      if (error) { setErr(error.message); notify.error(`Couldn't save: ${error.message}`); return; }
      notify.updated(gradState !== graduated ? (gradState ? "Marked as graduated" : "No longer graduated") : "Player updated", { description: name.trim() });
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

  const adding = playerId === "new";

  const toggleBlock = (
    <div className="relative grid grid-cols-2 rounded-xl border border-slate-600 bg-slate-950 p-1" role="radiogroup" aria-label="Who is joining the team">
      <span className="pointer-events-none absolute bottom-1 left-1 top-1 w-[calc(50%-.25rem)] rounded-lg bg-accent transition-transform duration-300 ease-out-quint motion-reduce:transition-none" style={{ transform: `translateX(${mode === "existing" ? 0 : 100}%)` }} aria-hidden="true" />
      {([["existing", "Existing person"], ["new", "New person"]] as const).map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => { setMode(v); setErr(""); }} className={`relative z-10 h-10 rounded-lg text-sm font-semibold transition-colors duration-200 ${mode === v ? "text-accent-ink" : "text-slate-300 hover:text-white"}`}>{label}</button>
      ))}
    </div>
  );

  const pickerBlock = (
    <div className="animate-fadeIn">
      <span className={lbl}>Who is joining <span className="text-accent">*</span></span>
      <PersonPicker cands={cands} value={chosen[0] ?? null} onChange={(c) => { setChosen(c ? [c] : []); if (err) setErr(""); }} onNew={(n) => { setName(n); setMode("new"); }} />
    </div>
  );

  const nameBlock = (
    <div>
      <label className={lbl} htmlFor="tp-name">Full name <span className="text-accent">*</span></label>
      <div className="relative">
        <input
          key={again}
          id="tp-name"
          className={`${input} pr-10 ${nameBad ? "!border-[#f87171]" : ""}`}
          value={name}
          maxLength={80}
          onChange={(e) => { setName(e.target.value); if (err) setErr(""); }}
          placeholder="e.g. Juan Dela Cruz"
          autoComplete="off"
          autoFocus={adding && mode === "new"}
          aria-invalid={nameBad}
        />
        {name && <button type="button" onClick={() => setName("")} aria-label="Clear name" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:text-white"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>}
      </div>
    </div>
  );

  const photoBlock = (
    <div>
      <span className={lbl}>Photo</span>
      <PhotoDropzone value={photo} onChange={setPhoto} name={name} folder="team_members" />
    </div>
  );

  const activeBlock = (
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
  );

  const graduatedBlock = (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3">
      <div>
        <p id="tp-grad-label" className="text-sm font-medium text-white">Graduated</p>
        <p className="text-xs text-slate-500">Finished their time with the team. Graduated players can&rsquo;t be put on teams or given roles.</p>
      </div>
      <Switch.Root
        checked={gradState}
        onCheckedChange={setGradState}
        aria-labelledby="tp-grad-label"
        className="relative inline-flex h-6 w-11 shrink-0 items-center cursor-pointer rounded-full border border-slate-600 bg-slate-800 outline-none transition-colors duration-200 focus-visible:shadow-[0_0_0_3px_rgba(200,245,96,.25)] data-[checked]:border-accent data-[checked]:bg-accent"
      >
        <Switch.Thumb className="block h-[18px] w-[18px] translate-x-[3px] rounded-full bg-slate-300 transition-transform duration-200 ease-out-quint data-[checked]:translate-x-[22px] data-[checked]:bg-accent-ink" />
      </Switch.Root>
    </div>
  );

  const teamRoleBlock = activeTeams.length === 0 ? (
    <p className="flex gap-3 rounded-xl border border-[#fbbf24]/40 bg-[#fbbf24]/5 p-3 text-sm text-slate-300">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#fbbf24]" aria-hidden="true" />
      There&rsquo;s no team in an active season to add this player to. Add a team (Competitions → Teams) and mark its season active first.
    </p>
  ) : (
    <>
      <div>
        <label className={lbl} htmlFor="tp-team">Team <span className="text-accent">*</span></label>
        <select id="tp-team" value={newTeam} onChange={(e) => { setNewTeam(e.target.value); if (err) setErr(""); }} className={`${input} ${err && !newTeam ? "!border-[#f87171]" : ""}`} aria-invalid={!!err && !newTeam}>
          <option value="">Choose a team…</option>
          {sortedTeams(activeTeams).map((t) => <option key={t.id} value={t.id}>{teamLabel(t)} · {seasonName(t.season_id) || "no season"}</option>)}
        </select>
      </div>
      <div>
        <span className={lbl} id="tp-role-label">Roles <span className="text-accent">*</span> <span className="font-sans normal-case tracking-normal text-slate-500">pick all that apply</span></span>
        <div role="group" aria-labelledby="tp-role-label" className="flex flex-wrap gap-2">
          {data.roles.length === 0 && <p className="text-sm text-slate-500">No roles yet. Add some under Roles first.</p>}
          {data.roles.map((r) => {
            const on = newRoles.includes(String(r.id));
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={on}
                onClick={() => { setNewRoles((cur) => (on ? cur.filter((x) => x !== String(r.id)) : [...cur, String(r.id)])); if (err) setErr(""); }}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors duration-150 ${on ? "border-accent bg-accent/10 text-accent" : err && newRoles.length === 0 ? "border-[#f87171]/60 text-slate-300 hover:border-slate-400" : "border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white"}`}
              >
                {on && <Check className="h-3.5 w-3.5" aria-hidden="true" />}{r.role_name}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );

  const detailsForm = (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-5" noValidate>
      {adding ? (
        // Assigning: who on the left, where and as what on the right, so it all shows at once.
        <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
          <div className="space-y-4">
            {toggleBlock}
            {mode === "existing" ? pickerBlock : <>{nameBlock}{photoBlock}</>}
          </div>
          <div className="space-y-4">
            {teamRoleBlock}
            {mode === "new" && activeBlock}
          </div>
        </div>
      ) : (
        <>{nameBlock}{photoBlock}{activeBlock}{graduatedBlock}</>
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
        ) : adding ? (
          <label className="inline-flex cursor-pointer select-none items-center gap-2.5 text-sm text-slate-300 transition-colors hover:text-white">
            <input type="checkbox" checked={another} onChange={(e) => setAnother(e.target.checked)} className="peer sr-only" />
            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${another ? "border-accent bg-accent text-accent-ink" : "border-slate-500"}`}>{another && <Check className="h-3.5 w-3.5" aria-hidden="true" />}</span>
            Add another team player
          </label>
        ) : <span />}
        {!confirmDelete && (
          <div className="flex gap-3">
            <Dialog.Close className="btn btn-ghost btn-sm" disabled={saving}>{editing ? "Close" : "Cancel"}</Dialog.Close>
            <button type="submit" disabled={saving || (adding && activeTeams.length === 0)} className="btn btn-primary btn-sm min-w-28 disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {editing ? "Save changes" : "Assign player"}
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
          <Dialog.Popup className={`my-4 w-full ${playerId === "new" ? "max-w-4xl" : "max-w-2xl"} rounded-2xl border border-slate-600 bg-slate-900 outline-none transition-[opacity,transform] duration-200 ease-out-quint data-[starting-style]:translate-y-2 data-[starting-style]:scale-[.97] data-[starting-style]:opacity-0 data-[ending-style]:scale-[.97] data-[ending-style]:opacity-0`}>
            <div className="flex items-start gap-4 p-6 pb-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent/40 bg-accent/10 text-accent">
                {playerId === "new" ? <UserPlus className="h-5 w-5" aria-hidden="true" /> : <Pencil className="h-5 w-5" aria-hidden="true" />}
              </span>
              <div className="min-w-0 flex-1">
                <Dialog.Title className="truncate font-display text-xl font-semibold text-white">{playerId === "new" ? (ctx ? `Assign to ${teamLabel(ctx)}` : "Assign team player") : player?.name ?? "Player"}</Dialog.Title>
                <Dialog.Description className="mt-0.5 text-sm text-slate-400">
                  {playerId === "new" ? "Choose a player, media team member or member, or add a new person. Then pick their team and roles. Anyone assigned becomes a player." : "Update details, teams and roles."}
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

/* ───────── Card (same look as the Media team / Members / Coaches pages) ───────── */
function PlayerPhoto({ p }: { p: Player }) {
  const [broken, setBroken] = useState(false);
  return p.profile_image_url && !broken ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.profile_image_url} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
  ) : (
    <span className="grid h-full w-full place-items-center font-display font-semibold text-slate-600" aria-hidden="true"><span className="text-[1.6em]">{initials(p.name)}</span></span>
  );
}

type CardProps = { p: Player; roles: string[]; otherSeasons: string[]; duplicate: boolean; delay: number; onEdit: () => void };

function PlayerCard({ p, roles, otherSeasons, duplicate, delay, onEdit }: CardProps) {
  const on = p.is_active !== false;
  const meta = [p.is_graduated ? "Graduated" : "", otherSeasons.length > 0 ? `Also: ${otherSeasons.join(", ")}` : ""].filter(Boolean).join(" · ");
  return (
    <li className="group min-w-0" style={{ animation: "rise .55s var(--ease) both", animationDelay: `${delay}ms` }}>
      <article className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 transition-[transform,border-color,box-shadow] duration-300 ease-out-quint hover:-translate-y-1 hover:border-slate-500 hover:shadow-[0_18px_40px_rgba(0,0,0,.45)]">
        <div className={`absolute inset-0 transition-[filter,opacity] duration-500 ${on ? "" : "opacity-60 saturate-0"}`}>
          <div className="h-full w-full text-sm transition-transform duration-700 ease-out group-hover:scale-[1.05]"><PlayerPhoto p={p} /></div>
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/30" aria-hidden="true" />

        {duplicate && <span title="Another player entry has this exact name" className="absolute left-3 top-3 rounded-md border border-[#fbbf24]/50 bg-slate-950/70 px-1.5 py-0.5 font-mono text-[.58rem] uppercase tracking-[.12em] text-[#fbbf24] backdrop-blur">Same name</span>}
        <span className={`absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border bg-slate-950/70 px-2.5 py-1 font-mono text-[.62rem] uppercase tracking-[.12em] backdrop-blur ${on ? "border-accent/40 text-accent" : "border-slate-600 text-slate-400"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-accent" : "bg-slate-500"}`} aria-hidden="true" />{on ? "Active" : "Inactive"}
        </span>

        <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 p-4">
          <div className="min-w-0 flex-1">
            <h3 className="break-words font-display text-base font-semibold leading-tight text-white sm:text-lg">{p.name}</h3>
            <p className="mt-1 break-words font-mono text-[.68rem] uppercase leading-snug tracking-[.14em] text-accent">{roles.length ? roles.join(" · ") : "Player"}</p>
            {meta && <p className="mt-1 truncate text-[.7rem] text-slate-400" title={meta}>{meta}</p>}
          </div>
          <span className="grid h-9 w-9 shrink-0 translate-y-2 place-items-center rounded-lg bg-slate-950/70 text-white opacity-0 backdrop-blur transition-[opacity,transform,background-color,color] duration-200 ease-out-quint group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:bg-accent group-hover:text-accent-ink group-hover:opacity-100 [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100" aria-hidden="true"><Pencil className="h-4 w-4" /></span>
        </div>

        {/* the whole card opens the player */}
        <button type="button" onClick={onEdit} aria-label={`Edit ${p.name}`} className="absolute inset-0 z-10 rounded-2xl outline-none focus-visible:shadow-[inset_0_0_0_2px_rgba(200,245,96,.6)]" />
      </article>
    </li>
  );
}

function PlayerRow({ p, roles, otherSeasons, duplicate, delay, onEdit }: CardProps) {
  const on = p.is_active !== false;
  const meta = [p.is_graduated ? "Graduated" : "", otherSeasons.length > 0 ? `Also: ${otherSeasons.join(", ")}` : ""].filter(Boolean).join(" · ");
  return (
    <li style={{ animation: "rise .4s var(--ease) both", animationDelay: `${delay}ms` }}>
      <button type="button" onClick={onEdit} aria-label={`Edit ${p.name}`} className="group grid w-full grid-cols-[2.75rem_1fr_auto] items-center gap-4 px-4 py-3 text-left outline-none transition-colors duration-150 hover:bg-slate-800/50 focus-visible:bg-slate-800/60 sm:grid-cols-[2.75rem_1fr_7rem_2.25rem]">
        <span className={`h-11 w-11 overflow-hidden rounded-xl border border-slate-600 bg-slate-800 text-sm transition-[filter,opacity] ${on ? "" : "opacity-60 saturate-0"}`}><PlayerPhoto p={p} /></span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className={`truncate text-sm font-semibold ${on ? "text-white" : "text-slate-400"}`}>{p.name}</span>
            {duplicate && <span title="Another player entry has this exact name" className="shrink-0 rounded-md border border-[#fbbf24]/50 px-1.5 py-0.5 font-mono text-[.58rem] uppercase tracking-[.12em] text-[#fbbf24]">Same name</span>}
          </span>
          <span className="block truncate font-mono text-[.68rem] uppercase tracking-[.12em] text-accent">{roles.length ? roles.join(" · ") : "Player"}</span>
          {meta && <span className="block truncate text-[.7rem] text-slate-500">{meta}</span>}
        </span>
        <span className={`hidden items-center gap-2 text-xs sm:inline-flex ${on ? "text-slate-300" : "text-slate-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-accent" : "bg-slate-500"}`} aria-hidden="true" />{on ? "Active" : "Inactive"}</span>
        <span className="grid h-9 w-9 place-items-center justify-self-end rounded-lg text-slate-500 transition-colors group-hover:bg-slate-800 group-hover:text-white" aria-hidden="true"><Pencil className="h-4 w-4" /></span>
      </button>
    </li>
  );
}

/* Players in one team (or the "not on a team" group), as portrait cards or a list. */
function PlayerList({ view, children }: { view: "grid" | "list"; children: React.ReactNode }) {
  return view === "grid" ? (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{children}</ul>
  ) : (
    <ul className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-700 bg-slate-900">{children}</ul>
  );
}

/* ───────── Panel ───────── */
export default function TeamPlayersPanel({ startNew = false }: { startNew?: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [season, setSeason] = useState("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [dialog, setDialog] = useState<number | "new" | null>(startNew ? "new" : null);
  const [dialogTeam, setDialogTeam] = useState<Team | null>(null); // the team whose roster the open player came from
  const [layout, setLayout] = useState<"grid" | "list">(() => {
    try { return localStorage.getItem("admin-people-view") === "list" ? "list" : "grid"; } catch { return "grid"; }
  });
  const changeLayout = (v: "grid" | "list") => { setLayout(v); try { localStorage.setItem("admin-people-view", v); } catch { /* private window */ } };

  const load = useCallback(async (fresh = false) => {
    if (fresh) bustContent();
    const stale = peek<Data>("tp:all");
    if (stale) setData(stale); // revisiting: show the last roster at once
    try {
      const d = await cached("tp:all", fetchAll, 60_000);
      setError("");
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load.");
    }

    async function fetchAll(): Promise<Data> {
    let seasonRes = await sb.from("seasons").select("id, season_name, is_active").order("id", { ascending: false });
    let noActiveColumn = false;
    if (seasonRes.error && (seasonRes.error.code === "42703" || /is_active/.test(seasonRes.error.message))) {
      noActiveColumn = true; // supabase/season-active.sql hasn't been run: the newest season counts as the active one
      seasonRes = (await sb.from("seasons").select("id, season_name").order("id", { ascending: false })) as typeof seasonRes;
    }
    const [players, teams, assigns, memberRoles, roles, regs, mediaRes] = await Promise.all([
      sb.from("team_members").select("id, name, profile_image_url, is_active, is_graduated").order("name").limit(5000),
      sb.from("teams").select("id, team_name, team_number, team_code, season_id").limit(2000),
      sb.from("member_team_seasons").select("id, member_id, team_id, season_id").limit(10000),
      sb.from("member_roles").select("id, member_id, role_id, season_id").limit(10000),
      sb.from("roles").select("id, role_name").order("role_name"),
      sb.from("members").select("id, name, image_url, is_active").order("name").limit(5000), // only feeds the person picker, so a failure here isn't fatal
      sb.from("media_team").select("id, name, position, image_url, is_active").order("name").limit(2000),
    ]);
    const failed = [seasonRes, players, teams, assigns, memberRoles, roles].find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
    return {
      players: (players.data ?? []) as Player[], teams: (teams.data ?? []) as Team[], seasons: ((seasonRes.data ?? []) as { id: number; season_name: string | null; is_active?: boolean }[]).map((x, i) => ({ id: x.id, season_name: x.season_name, is_active: noActiveColumn ? i === 0 : x.is_active === true })),
      assigns: (assigns.data ?? []) as Assign[], memberRoles: (memberRoles.data ?? []) as MemberRole[], roles: (roles.data ?? []) as Role[],
      members: (regs.data ?? []) as Reg[], media: (mediaRes.data ?? []) as Media[],
    };
    }
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
    const passes = (p: Player) => (!q || p.name.toLowerCase().includes(q)) && (status === "all" || (status === "active") === (p.is_active !== false));
    const filtering = !!q || status !== "all";

    const nameCount = new Map<string, number>();
    for (const p of data.players) { const k = p.name.trim().toLowerCase(); nameCount.set(k, (nameCount.get(k) ?? 0) + 1); }

    const teams = data.teams
      .filter((t) => season === "all" || String(t.season_id) === season)
      .sort((a, b) => (order.get(a.season_id ?? -1) ?? 999) - (order.get(b.season_id ?? -1) ?? 999) || a.team_number - b.team_number);

    const groups = teams.map((t) => {
      const ids = [...new Set(data.assigns.filter((a) => a.team_id === t.id).map((a) => a.member_id))];
      const members = ids.map((id) => playerById.get(id)).filter((p): p is Player => !!p && passes(p)).sort((a, b) => a.name.localeCompare(b.name));
      return { team: t, seasonName: seasonName(t.season_id), members, total: ids.length };
    }).filter((g) => (filtering ? g.members.length > 0 : true));

    const assignedIds = new Set(data.assigns.map((a) => a.member_id));
    const unassigned = season === "all" ? data.players.filter((p) => !assignedIds.has(p.id) && passes(p)) : [];

    const shownPlayers = new Map<number, Player>();
    for (const g of groups) for (const m of g.members) shownPlayers.set(m.id, m);
    for (const p of unassigned) shownPlayers.set(p.id, p);
    const uniquePlayers = shownPlayers.size;
    const activePlayers = [...shownPlayers.values()].filter((p) => p.is_active !== false).length;
    return { groups, unassigned, seasonName, nameCount, uniquePlayers, activePlayers };
  }, [data, season, query, status]);

  const rolesFor = (memberId: number, seasonId: number | null) =>
    (data?.memberRoles ?? []).filter((r) => r.member_id === memberId && r.season_id === seasonId).map((r) => data!.roles.find((x) => x.id === r.role_id)?.role_name ?? "").filter(Boolean);
  const otherSeasonsFor = (memberId: number, seasonId: number | null) =>
    [...new Set((data?.assigns ?? []).filter((a) => a.member_id === memberId && a.season_id !== seasonId).map((a) => a.season_id))]
      .sort((a, b) => b - a).map((id) => view!.seasonName(id));

  const toggle = (id: number) => setCollapsed((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; });
  const allIds = view?.groups.map((g) => g.team.id) ?? [];
  const allCollapsed = allIds.length > 0 && allIds.every((id) => collapsed.has(id));
  const Item = layout === "grid" ? PlayerCard : PlayerRow;

  const total = view?.uniquePlayers ?? 0;
  const active = view?.activePlayers ?? 0;
  const pct = total ? Math.round((active / total) * 100) : 0;
  const stack = (data?.players ?? []).filter((p) => p.profile_image_url).slice(0, 5);
  const filtered = !!query.trim() || status !== "all";

  return (
    <section aria-labelledby="panel-title" className="pb-16">
      {/* ───── Header ───── */}
      <header className="relative mb-6 overflow-hidden rounded-3xl border border-slate-700 bg-slate-900/60 p-6 sm:p-8" style={{ animation: "rise .6s var(--ease) both" }}>
        <span className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent/15 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="font-mono text-[.7rem] uppercase tracking-[.2em] text-accent">Website roster</p>
            <h1 id="panel-title" className="mt-2 font-display text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">Team players</h1>
            <p className="mt-3 text-slate-400">Players grouped by team. Someone who played in several seasons appears under each team, labelled with the season.</p>
            {stack.length > 0 && (
              <div className="mt-5 flex items-center gap-3">
                <div className="flex -space-x-2.5" aria-hidden="true">
                  {stack.map((p, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={p.id} src={p.profile_image_url!} alt="" loading="lazy" className="h-9 w-9 rounded-full border-2 border-slate-900 object-cover" style={{ animation: "rise .5s var(--ease) both", animationDelay: `${i * 70 + 250}ms` }} />
                  ))}
                </div>
                {(data?.players.length ?? 0) > stack.length && <span className="text-sm text-slate-400">+{(data?.players.length ?? 0) - stack.length} more</span>}
              </div>
            )}
          </div>

          <div className="w-full max-w-md lg:w-[22rem]">
            <dl className="grid grid-cols-3 gap-2 sm:gap-3">
              {([["Players", total, "text-white"], ["Active", active, "text-accent"], ["Teams", view?.groups.length ?? 0, "text-slate-300"]] as const).map(([k, n, c]) => (
                <div key={k} className="min-w-0 rounded-2xl border border-slate-700 bg-slate-950/50 px-3 py-3 sm:px-4">
                  <dt className="text-xs text-slate-400">{k}</dt>
                  <dd className={`mt-1 font-display text-2xl font-bold leading-none tabular-nums sm:text-3xl ${c}`}><NumberFlow value={n} /></dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800" role="img" aria-label={`${pct}% of players are active`}>
                <div className="h-full rounded-full bg-accent transition-[width] duration-[900ms] ease-out-quint" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-24 shrink-0 text-right text-xs text-slate-400"><span className="font-mono tabular-nums text-white">{pct}%</span> active</span>
            </div>
          </div>
        </div>
      </header>

      {/* ───── Toolbar (stays in view while you scroll) ───── */}
      <div className="mb-4 rounded-2xl border border-slate-700 bg-slate-950/85 p-2 shadow-[0_10px_30px_rgba(0,0,0,.35)] backdrop-blur lg:sticky lg:top-3 lg:z-20" style={{ animation: "rise .6s var(--ease) both", animationDelay: "80ms" }}>
        <div className="grid grid-cols-[1fr_auto] gap-2 lg:grid-cols-[1fr_auto_13rem_auto] lg:items-center">
          <label className="relative col-span-2 block lg:col-span-1">
            <span className="sr-only">Search players</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" className="h-11 w-full rounded-xl bg-slate-900 pl-11 pr-4 text-sm font-medium text-white outline-none transition-shadow placeholder:text-slate-500 focus-visible:shadow-[0_0_0_2px_rgba(200,245,96,.5)]" />
          </label>
          <div className="relative col-span-2 flex w-full gap-1 rounded-xl bg-slate-900 p-1 lg:col-span-1 lg:inline-flex lg:w-fit" role="group" aria-label="Status">
            {(["all", "active", "inactive"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={status === k} onClick={() => setStatus(k)}
                className={`h-10 flex-1 rounded-lg px-4 text-sm font-semibold capitalize transition-[background-color,color] duration-200 lg:h-9 lg:flex-none ${status === k ? "bg-accent text-accent-ink" : "text-slate-300 hover:text-white"}`}>{k}</button>
            ))}
          </div>
          <Dropdown
            className="w-full"
            hideLabel
            label="Season"
            items={[{ label: "All seasons", value: "all" }, ...(data?.seasons ?? []).map((s) => ({ label: String(s.season_name), value: String(s.id) }))]}
            value={season}
            onValueChange={setSeason}
            disabled={!data}
          />
          <div className="inline-flex w-fit gap-1 self-stretch rounded-xl bg-slate-900 p-1" role="group" aria-label="View">
            {([["grid", LayoutGrid, "Grid view"], ["list", List, "List view"]] as const).map(([k, Icon, label]) => (
              <button key={k} type="button" aria-pressed={layout === k} aria-label={label} title={label} onClick={() => changeLayout(k)}
                className={`grid h-10 w-10 place-items-center rounded-lg transition-[background-color,color] duration-200 lg:h-9 lg:w-9 ${layout === k ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}><Icon className="h-4 w-4" aria-hidden="true" /></button>
            ))}
          </div>
        </div>
      </div>

      {view && view.groups.length > 0 && (
        <div className="mb-4 flex items-center justify-between px-1 text-sm text-slate-400" aria-live="polite">
          <p><span className="font-mono tabular-nums text-white">{String(total).padStart(2, "0")}</span> {total === 1 ? "player" : "players"}{filtered && <> match</>}</p>
          <button type="button" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(allIds))} className="font-medium text-slate-300 underline-offset-4 transition-colors hover:text-white hover:underline">
            {allCollapsed ? "Show all teams" : "Hide all teams"}
          </button>
        </div>
      )}

      {error && <p role="alert" className="mb-5 rounded-xl border border-[#ef4444]/40 p-3 text-sm text-[#f87171]">{error}</p>}

      {/* ───── Results ───── */}
      {!view ? (
        <div className="space-y-8" aria-hidden="true">
          {[...Array(2)].map((_, i) => (
            <div key={i}>
              <div className="mb-4 h-6 w-48 animate-pulse rounded bg-slate-800" />
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{[...Array(4)].map((__, j) => <div key={j} className="aspect-[4/5] animate-pulse rounded-2xl border border-slate-700 bg-slate-900" style={{ animationDelay: `${j * 80}ms` }} />)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div key={`${season}-${status}-${query ? "q" : ""}-${layout}`} className="space-y-4">
          {view.groups.map((g, gi) => {
            const open = !collapsed.has(g.team.id);
            return (
              <section key={g.team.id} className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/60" style={{ animation: "rise .5s var(--ease) both", animationDelay: `${Math.min(gi, 6) * 60}ms` }}>
                {/* one aligned row: team name, player count, Assign, expand. The global focus outline is replaced by a soft ring. */}
                <div className="flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-5 sm:py-4">
                  <button type="button" onClick={() => toggle(g.team.id)} aria-expanded={open} aria-controls={`tp-${g.team.id}`} className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none! focus-visible:shadow-[0_0_0_3px_rgba(200,245,96,.3)] sm:gap-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-600 bg-slate-900 font-mono text-xs font-semibold text-accent">{g.team.team_number}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-base font-semibold text-white sm:text-lg">{teamLabel(g.team)}{g.team.team_name && g.team.team_code ? <span className="ml-2 text-sm font-normal text-slate-400">{g.team.team_name}</span> : null}</span>
                      <span className="block font-mono text-[.7rem] uppercase tracking-[.14em] text-slate-400">{g.seasonName}</span>
                    </span>
                  </button>
                  <span className="inline-flex h-8 shrink-0 items-center rounded-full border border-slate-600 px-3 font-mono text-xs tabular-nums text-slate-300">{g.total}<span className="hidden sm:inline">&nbsp;{g.total === 1 ? "player" : "players"}</span></span>
                  {(() => {
                    const live = (data?.seasons ?? []).some((x) => x.id === g.team.season_id && x.is_active); // new entries only go into active seasons
                    return (
                      <button
                        type="button"
                        disabled={!live}
                        onClick={() => { setDialogTeam(g.team); setDialog("new"); }}
                        aria-label={`Assign a player to ${teamLabel(g.team)}`}
                        title={live ? `Assign a player to ${teamLabel(g.team)}` : "This season isn't active, so no one can be added"}
                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 text-sm font-semibold text-accent outline-none! transition-colors focus-visible:shadow-[0_0_0_3px_rgba(200,245,96,.3)] enabled:hover:bg-accent enabled:hover:text-accent-ink disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-transparent disabled:text-slate-600 sm:px-3.5"
                      >
                        <UserPlus className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Assign</span>
                      </button>
                    );
                  })()}
                  <button type="button" onClick={() => toggle(g.team.id)} aria-expanded={open} aria-controls={`tp-${g.team.id}`} aria-label={open ? `Hide ${teamLabel(g.team)} players` : `Show ${teamLabel(g.team)} players`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 outline-none! transition-colors hover:bg-slate-800/70 hover:text-white focus-visible:shadow-[0_0_0_3px_rgba(200,245,96,.3)]">
                    <ChevronDown className={`h-4 w-4 transition-transform duration-300 ease-out-quint ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                </div>
                <div id={`tp-${g.team.id}`} inert={!open} className={`grid transition-[grid-template-rows] duration-300 ease-out-quint ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="min-h-0 overflow-hidden">
                    <div className="border-t border-slate-700 p-4">
                      {g.members.length === 0 ? (
                        <p className="py-4 text-center text-sm text-slate-500">No players on this team yet.</p>
                      ) : (
                        <PlayerList view={layout}>
                          {g.members.map((p, i) => (
                            <Item
                              key={p.id}
                              p={p}
                              roles={rolesFor(p.id, g.team.season_id)}
                              otherSeasons={season === "all" ? otherSeasonsFor(p.id, g.team.season_id) : []}
                              duplicate={(view.nameCount.get(p.name.trim().toLowerCase()) ?? 0) > 1}
                              delay={Math.min(i, 11) * 45}
                              onEdit={() => { setDialogTeam(g.team); setDialog(p.id); }}
                            />
                          ))}
                        </PlayerList>
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
              <div className="mt-4">
                <PlayerList view={layout}>
                  {view.unassigned.map((p, i) => (
                    <Item key={p.id} p={p} roles={[]} otherSeasons={[]} duplicate={(view.nameCount.get(p.name.trim().toLowerCase()) ?? 0) > 1} delay={Math.min(i, 11) * 45} onEdit={() => { setDialogTeam(null); setDialog(p.id); }} />
                  ))}
                </PlayerList>
              </div>
            </section>
          )}

          {view.groups.length === 0 && view.unassigned.length === 0 && (
            <div className="grid place-items-center rounded-3xl border border-dashed border-slate-600 px-6 py-20 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl border border-accent/40 bg-accent/10 text-accent"><Camera className="h-6 w-6" aria-hidden="true" /></span>
              <p className="mt-5 font-display text-lg font-semibold text-white">{filtered ? "No one matches those filters" : "No teams or players yet"}</p>
              <p className="mt-1 max-w-sm text-sm text-slate-400">{filtered ? "Try a different search or status." : "There are no teams or players for this season yet."}</p>
              {filtered && <button type="button" onClick={() => { setQuery(""); setStatus("all"); }} className="btn btn-ghost btn-sm mt-6">Clear filters</button>}
            </div>
          )}
        </div>
      )}

      {/* Add button: pinned to the corner of the screen, rendered into <body> so no padded or animated parent can offset it. */}
      {typeof document !== "undefined" && dialog === null && createPortal(
        <button type="button" onClick={() => { setDialogTeam(null); setDialog("new"); }} className="btn btn-primary animate-fadeIn shadow-[0_10px_30px_rgba(0,0,0,.5)]" style={{ position: "fixed", right: 12, bottom: 12, zIndex: 30 }}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Assign team player
        </button>,
        document.body,
      )}

      {data && (
        <PlayerDialog
          playerId={dialog}
          ctx={dialogTeam}
          open={dialog !== null}
          data={data}
          onClose={() => setDialog(null)}
          onChanged={() => load(true)}
          onCreated={(id) => setDialog(id)}
        />
      )}
    </section>
  );
}
