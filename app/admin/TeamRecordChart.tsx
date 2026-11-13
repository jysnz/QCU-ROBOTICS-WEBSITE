"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Dropdown from "../components/Dropdown";
import { sb } from "./supabase";

type Row = { seasonId: number | null; name: string; sub: string; win: number; loss: number; tie: number; total: number; winRate: number; winPct: number; lossPct: number; tiePct: number };

const WIN = "#c8f560";
const LOSS = "#f87171";
const TIE = "#64748b";

/* Win rate per team: one stacked 100% bar per team that has recorded matches (green wins, red losses, grey ties),
   with the win rate printed at the end. Hover a bar for the exact W-L-T. Recharts handles the draw-in animation. */
export default function TeamRecordChart() {
  const [all, setAll] = useState<Row[] | null>(null);
  const [seasons, setSeasons] = useState<{ id: number; name: string }[]>([]);
  const [season, setSeason] = useState("all");
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [matches, teams, seasons] = await Promise.all([
        sb.from("matches").select("team_id, result").not("team_id", "is", null).limit(5000),
        sb.from("teams").select("id, team_name, team_code, season_id"),
        sb.from("seasons").select("id, season_name"),
      ]);
      if (cancelled) return;
      if (matches.error || teams.error) { setError(true); return; }

      const seasonName = new Map((seasons.data ?? []).map((s) => [s.id, String(s.season_name ?? "")]));
      const tally = new Map<number, { win: number; loss: number; tie: number }>();
      for (const m of matches.data ?? []) {
        const t = tally.get(m.team_id) ?? { win: 0, loss: 0, tie: 0 };
        const v = String(m.result ?? "").toLowerCase();
        if (v.startsWith("w")) t.win++;
        else if (v.startsWith("l")) t.loss++;
        else if (v.startsWith("t") || v.startsWith("d")) t.tie++;
        tally.set(m.team_id, t);
      }

      const out: Row[] = [];
      for (const team of teams.data ?? []) {
        const t = tally.get(team.id);
        if (!t) continue;
        const total = t.win + t.loss + t.tie;
        if (total === 0) continue; // matches without a recorded result don't count
        out.push({
          seasonId: team.season_id ?? null,
          name: String(team.team_code || team.team_name || `Team ${team.id}`),
          sub: seasonName.get(team.season_id) ?? "",
          ...t,
          total,
          winRate: Math.round((t.win / total) * 100),
          winPct: (t.win / total) * 100,
          lossPct: (t.loss / total) * 100,
          tiePct: (t.tie / total) * 100,
        });
      }
      // Only offer seasons that actually have a team with results; newest first (ids grow with each season).
      const used = new Set(out.map((r) => r.seasonId));
      setSeasons(
        (seasons.data ?? [])
          .filter((x) => used.has(x.id))
          .sort((a, b) => b.id - a.id)
          .map((x) => ({ id: x.id, name: String(x.season_name ?? `Season ${x.id}`) })),
      );
      setAll(out);
    })();
    return () => { cancelled = true; };
  }, []);

  const rows = useMemo(() => {
    if (!all) return null;
    const list = season === "all" ? all : all.filter((r) => String(r.seasonId) === season);
    return [...list].sort((a, b) => b.winRate - a.winRate || b.total - a.total);
  }, [all, season]);

  const height = useMemo(() => Math.max(160, (rows?.length ?? 0) * 46 + 50), [rows]);

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5" aria-label="Win rate per team">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h3 className="font-mono text-xs uppercase tracking-[.16em] text-slate-400">Win rate per team</h3>
        {seasons.length > 0 && (
          <Dropdown
            className="w-full sm:order-last sm:w-56"
            label="Season"
            items={[{ label: "All seasons", value: "all" }, ...seasons.map((x) => ({ label: x.name, value: String(x.id) }))]}
            value={season}
            onValueChange={setSeason}
          />
        )}
        <ul className="flex gap-4 text-xs text-slate-400" aria-hidden="true">
          {([["Wins", WIN], ["Losses", LOSS], ["Ties", TIE]] as const).map(([l, c]) => (
            <li key={l} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</li>
          ))}
        </ul>
      </div>

      {error ? (
        <p className="mt-6 text-sm text-slate-500">Couldn&rsquo;t load match results.</p>
      ) : rows === null ? (
        <div className="mt-6 space-y-3" aria-hidden="true">{[...Array(4)].map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-slate-800" />)}</div>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">{season === "all" ? "No teams have recorded match results yet. Add matches with a team and a result to see this chart." : "No teams have recorded results in this season."}</p>
      ) : (
        <div className="mt-4" style={{ height }} role="img" aria-label={rows.map((r) => `${r.name}: ${r.winRate}% win rate from ${r.total} matches`).join(". ")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 52, bottom: 0, left: 0 }} barCategoryGap={10}>
              <CartesianGrid horizontal={false} stroke="#2a2f3d" strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} stroke="#475569" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={84} stroke="#475569" tick={{ fill: "#e2e8f0", fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,.04)" }}
                content={({ active, payload }) => {
                  const r = active ? (payload?.[0]?.payload as Row | undefined) : undefined;
                  if (!r) return null;
                  return (
                    <div className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-xs shadow-xl">
                      <p className="font-semibold text-white">{r.name}{r.sub ? <span className="font-normal text-slate-400"> · {r.sub}</span> : null}</p>
                      <p className="mt-1 text-slate-300"><span className="font-mono tabular-nums text-white">{r.win}</span> W · <span className="font-mono tabular-nums text-white">{r.loss}</span> L · <span className="font-mono tabular-nums text-white">{r.tie}</span> T</p>
                      <p className="mt-0.5 text-slate-400">{r.winRate}% win rate · {r.total} {r.total === 1 ? "match" : "matches"}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="winPct" stackId="a" fill={WIN} radius={[4, 0, 0, 4]} animationDuration={900} />
              <Bar dataKey="tiePct" stackId="a" fill={TIE} animationDuration={900} />
              <Bar dataKey="lossPct" stackId="a" fill={LOSS} radius={[0, 4, 4, 0]} animationDuration={900}>
                <LabelList dataKey="winRate" position="right" formatter={(v) => `${v}%`} fill="#f8fafc" fontSize={12} fontWeight={600} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
