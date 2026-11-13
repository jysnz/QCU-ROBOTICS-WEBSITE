"use client";

import { useEffect, useState } from "react";
import NumberFlow from "@number-flow/react";
import { sb } from "./supabase";

type Record3 = { win: number; loss: number; tie: number };
type SeasonRow = { id: number; name: string; players: number };

/* Two small summaries under the quick actions: the team's match record and how many players each season had. */
export default function Insights() {
  const [record, setRecord] = useState<Record3 | null>(null);
  const [seasons, setSeasons] = useState<SeasonRow[] | null>(null);
  const [shown, setShown] = useState(false); // flips after data arrives so the bars grow from zero

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [matches, seasonRows, assignments] = await Promise.all([
        sb.from("matches").select("result").limit(5000),
        sb.from("seasons").select("id, season_name").order("id", { ascending: false }),
        sb.from("member_team_seasons").select("season_id, member_id").limit(5000),
      ]);
      if (cancelled) return;

      const r: Record3 = { win: 0, loss: 0, tie: 0 };
      for (const m of matches.data ?? []) {
        const v = String(m.result ?? "").toLowerCase();
        if (v.startsWith("w")) r.win++;
        else if (v.startsWith("l")) r.loss++;
        else if (v.startsWith("t") || v.startsWith("d")) r.tie++;
      }
      setRecord(r);

      const bySeason = new Map<number, Set<number>>();
      for (const a of assignments.data ?? []) {
        if (!bySeason.has(a.season_id)) bySeason.set(a.season_id, new Set());
        bySeason.get(a.season_id)!.add(a.member_id); // a player counts once per season
      }
      setSeasons((seasonRows.data ?? []).map((s) => ({ id: s.id, name: String(s.season_name ?? `Season ${s.id}`), players: bySeason.get(s.id)?.size ?? 0 })));
      requestAnimationFrame(() => requestAnimationFrame(() => { if (!cancelled) setShown(true); }));
    })();
    return () => { cancelled = true; };
  }, []);

  const total = record ? record.win + record.loss + record.tie : 0;
  const pct = (n: number) => (total ? (n / total) * 100 : 0);
  const max = Math.max(1, ...(seasons ?? []).map((s) => s.players));
  const bar = "h-full origin-left rounded-full transition-[width] duration-[900ms] ease-out-quint";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5" aria-label="Match record">
        <div className="flex items-baseline justify-between">
          <h3 className="font-mono text-xs uppercase tracking-[.16em] text-slate-400">Match record</h3>
          {record && total > 0 && (
            <p className="text-sm text-slate-400"><span className="font-display text-xl font-bold text-white"><NumberFlow value={Math.round(pct(record.win))} suffix="%" /></span> win rate</p>
          )}
        </div>

        {record === null ? (
          <div className="mt-6 h-3 animate-pulse rounded-full bg-slate-800" aria-hidden="true" />
        ) : total === 0 ? (
          <p className="mt-6 text-sm text-slate-500">No match results yet.</p>
        ) : (
          <>
            <div className="mt-6 flex h-3 gap-1 overflow-hidden rounded-full bg-slate-800" role="img" aria-label={`${record.win} wins, ${record.loss} losses, ${record.tie} ties`}>
              <div className="h-full rounded-full bg-accent transition-[width] duration-[900ms] ease-out-quint" style={{ width: shown ? `${pct(record.win)}%` : "0%" }} />
              <div className="h-full rounded-full bg-[#f87171] transition-[width] duration-[900ms] ease-out-quint" style={{ width: shown ? `${pct(record.loss)}%` : "0%", transitionDelay: "100ms" }} />
              <div className="h-full rounded-full bg-slate-500 transition-[width] duration-[900ms] ease-out-quint" style={{ width: shown ? `${pct(record.tie)}%` : "0%", transitionDelay: "200ms" }} />
            </div>
            <ul className="mt-5 grid grid-cols-3 gap-3">
              {([["Wins", record.win, "bg-accent"], ["Losses", record.loss, "bg-[#f87171]"], ["Ties", record.tie, "bg-slate-500"]] as const).map(([label, n, dot]) => (
                <li key={label}>
                  <p className="font-display text-2xl font-bold tabular-nums text-white"><NumberFlow value={n} /></p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-400"><span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />{label}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5" aria-label="Players per season">
        <h3 className="font-mono text-xs uppercase tracking-[.16em] text-slate-400">Players per season</h3>
        {seasons === null ? (
          <div className="mt-6 space-y-3" aria-hidden="true">{[...Array(3)].map((_, i) => <div key={i} className="h-4 animate-pulse rounded bg-slate-800" />)}</div>
        ) : seasons.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">No seasons yet.</p>
        ) : (
          <ul className="mt-5 space-y-3.5">
            {seasons.slice(0, 6).map((s, i) => (
              <li key={s.id} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3 text-sm">
                <span className="truncate text-slate-300">{s.name}</span>
                <span className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <span className={`block ${bar} bg-accent`} style={{ width: shown ? `${(s.players / max) * 100}%` : "0%", transitionDelay: `${i * 80}ms` }} />
                </span>
                <span className="text-right font-mono text-xs tabular-nums text-slate-400">{s.players}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
