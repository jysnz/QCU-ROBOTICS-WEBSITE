"use client";

import { useState } from "react";
import { Tabs } from "@base-ui/react/tabs";
import Dropdown from "./Dropdown";

type Competition = { id: number | string; title: string; season_id?: number | string | null };
type Team = { id: number | string; team_code?: string | null; team_number?: number | string | null };
type Season = { id: number | string; season_name?: string | null };

const labelCls = "font-mono text-[.7rem] font-medium uppercase tracking-[.16em] text-slate-400";

/* Shared by /matches and /achievements: season + competition dropdowns and team tabs.
   The season filter narrows the competition list; picking a season whose competitions don't
   include the current one moves the selection to that season's first competition. */
export default function CompetitionFilters({
  seasons = [],
  competitions,
  selectedComp,
  onCompChange,
  teams,
  selectedTeam,
  onTeamChange,
}: {
  seasons?: Season[];
  competitions: Competition[];
  selectedComp: number | string | null;
  onCompChange: (id: number | string) => void;
  teams: Team[];
  selectedTeam: number | string | null;
  onTeamChange: (id: number | string) => void;
}) {
  const [season, setSeason] = useState<string>("all");

  // Newest season first. Season names are game titles (Override, Push Back, ...), so alphabetical order
  // would be wrong; ids grow with each new season.
  const sortedSeasons = [...seasons].sort((a, b) => Number(b.id) - Number(a.id));
  const visible = season === "all" ? competitions : competitions.filter((c) => String(c.season_id) === season);

  const seasonItems = [
    { label: "All seasons", value: "all" },
    ...sortedSeasons.map((s) => ({ label: String(s.season_name ?? `Season ${s.id}`), value: String(s.id) })),
  ];
  const compItems = visible.map((c) => ({ label: c.title, value: String(c.id) }));
  const teamLabel = (t: Team) => t.team_code || `Team ${t.team_number ?? t.id}`;

  const changeSeason = (next: string) => {
    setSeason(next);
    const inSeason = next === "all" ? competitions : competitions.filter((c) => String(c.season_id) === next);
    if (inSeason.length > 0 && !inSeason.some((c) => String(c.id) === String(selectedComp))) onCompChange(inSeason[0].id);
  };

  const hasSeasons = sortedSeasons.length > 0;

  return (
    <div className={`grid gap-6 border-y border-slate-700 py-6 md:gap-x-8 ${hasSeasons ? "md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:grid-cols-[minmax(0,13rem)_minmax(0,22rem)_1fr]" : "md:grid-cols-[minmax(0,24rem)_1fr]"} md:items-end`}>
      {hasSeasons && (
        <Dropdown label="Season" items={seasonItems} value={season} onValueChange={changeSeason} />
      )}

      <Dropdown
        label="Competition"
        items={compItems}
        value={selectedComp !== null && visible.some((c) => String(c.id) === String(selectedComp)) ? String(selectedComp) : null}
        onValueChange={(v) => {
          const match = competitions.find((c) => String(c.id) === v);
          if (match) onCompChange(match.id);
        }}
        placeholder={visible.length === 0 ? "No competitions in this season" : "Select a competition"}
        disabled={visible.length === 0}
      />

      <div className={`flex min-w-0 flex-col gap-2 ${hasSeasons ? "md:col-span-2 lg:col-span-1" : ""}`}>
        <span className={labelCls} id="team-label">Team</span>
        {teams.length > 0 ? (
          <Tabs.Root
            value={selectedTeam === null ? "" : String(selectedTeam)}
            onValueChange={(v) => {
              const match = teams.find((t) => String(t.id) === v);
              if (match) onTeamChange(match.id);
            }}
          >
            <Tabs.List
              aria-labelledby="team-label"
              className="relative inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-600 bg-slate-900 p-1"
            >
              {teams.map((t) => (
                <Tabs.Tab
                  key={t.id}
                  value={String(t.id)}
                  className="relative z-10 h-10 shrink-0 cursor-pointer rounded-lg px-5 text-sm font-semibold text-slate-300 outline-none transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-accent data-[active]:text-accent-ink"
                >
                  {teamLabel(t)}
                </Tabs.Tab>
              ))}
              <Tabs.Indicator className="absolute left-0 top-1 -z-0 h-[calc(100%-0.5rem)] w-[var(--active-tab-width)] translate-x-[var(--active-tab-left)] rounded-lg bg-accent transition-[translate,width] duration-300 ease-out-quint" />
            </Tabs.List>
          </Tabs.Root>
        ) : (
          <p className="flex h-12 items-center text-sm text-slate-400">No teams are linked to this competition.</p>
        )}
      </div>
    </div>
  );
}
