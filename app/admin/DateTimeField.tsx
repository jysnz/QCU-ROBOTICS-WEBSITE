"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock } from "lucide-react";

/* One day plus a time, picked on the same calendar look as DateRangeField (used for a task's due date).
   The value is "YYYY-MM-DDTHH:mm" in local time (what <input type="datetime-local"> used to give), or "" for none. */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DOW_LONG = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const key = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const pad = (n: number) => String(n).padStart(2, "0");
const PRESETS: [string, string][] = [["9:00 AM", "09:00"], ["12:00 PM", "12:00"], ["5:00 PM", "17:00"], ["11:59 PM", "23:59"]];

function parse(v: string): { date: Date; time: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(v);
  return m ? { date: new Date(+m[1], +m[2] - 1, +m[3]), time: m[4] } : null;
}
const compose = (d: Date, time: string) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${time}`;
/** Earliest time still allowed on today: the next 5-minute mark after now, or null when today has no time left. */
function earliestToday(): string | null {
  const n = new Date();
  const mins = Math.ceil((n.getHours() * 60 + n.getMinutes() + 1) / 5) * 5;
  return mins >= 24 * 60 ? null : `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
}
function clock(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
}

export default function DateTimeField({ id, value, onChange, minToday, required }: { id?: string; value: string; onChange: (v: string) => void; minToday?: boolean; required?: boolean }) {
  const parsed = useMemo(() => parse(value), [value]);
  const [open, setOpen] = useState(false);
  const base = parsed?.date ?? new Date();
  const [view, setView] = useState({ y: base.getFullYear(), m: base.getMonth() });
  const [years, setYears] = useState(false);

  const first = new Date(view.y, view.m, 1).getDay();
  const count = new Date(view.y, view.m + 1, 0).getDate();
  const todayKey = key(new Date());
  const selKey = parsed ? key(parsed.date) : null;
  // for a new task nothing earlier than now: on today the time can't go before the next 5-minute mark
  const minTime = (d: Date) => (minToday && key(d) === todayKey ? earliestToday() ?? "00:00" : "00:00");
  const fit = (d: Date, t: string) => (t < minTime(d) ? minTime(d) : t);
  const time = parsed?.time ?? "17:00";
  const dayMin = parsed ? minTime(parsed.date) : "00:00";
  const todayGone = !!minToday && earliestToday() === null; // after 11:55 PM there is no time left today

  const move = (n: number) => setView((v) => { const d = new Date(v.y, v.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const yearList = Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - 1 + i);
  const label = parsed ? `${DOW_LONG[parsed.date.getDay()]}, ${MONTHS[parsed.date.getMonth()].slice(0, 3)} ${parsed.date.getDate()}, ${parsed.date.getFullYear()} · ${clock(parsed.time)}` : "";

  return (
    <div>
      <button
        type="button" id={id} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}
        className={`flex h-11 w-full items-center gap-3 rounded-xl border bg-slate-950 px-4 text-left text-sm outline-none! transition-[border-color,box-shadow] hover:border-slate-500 focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_rgba(200,245,96,.18)] ${open ? "border-accent" : "border-slate-600"}`}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <span className={`min-w-0 flex-1 truncate ${value ? "font-medium text-white" : "text-slate-500"}`}>{label || (required ? "Pick a due date and time" : "No due date")}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out-quint ${open ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`} aria-hidden={!open} inert={!open}>
        <div className="overflow-hidden">
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <button type="button" onClick={() => setYears((y) => !y)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-display text-sm font-semibold text-white transition-colors hover:bg-slate-800" aria-label="Choose year">
                {MONTHS[view.m]} {view.y}<ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${years ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              <div className="flex gap-1">
                <button type="button" onClick={() => move(-1)} aria-label="Previous month" className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
                <button type="button" onClick={() => move(1)} aria-label="Next month" className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
              </div>
            </div>

            {years ? (
              <div className="grid grid-cols-4 gap-1.5 py-1">
                {yearList.map((y) => (
                  <button key={y} type="button" disabled={!!minToday && y < new Date().getFullYear()} onClick={() => { setView((v) => ({ ...v, y })); setYears(false); }} className={`h-9 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 ${y === view.y ? "bg-accent text-accent-ink" : "text-slate-300 hover:bg-slate-800"}`}>{y}</button>
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 text-center font-mono text-[.65rem] uppercase text-slate-500" aria-hidden="true">{DOW.map((d) => <span key={d} className="py-1">{d}</span>)}</div>
                <div className="grid grid-cols-7" role="grid">
                  {Array.from({ length: first }, (_, i) => <span key={`b${i}`} />)}
                  {Array.from({ length: count }, (_, i) => {
                    const d = new Date(view.y, view.m, i + 1);
                    const k = key(d);
                    const sel = k === selKey;
                    const past = !!minToday && (k < todayKey || (k === todayKey && todayGone));
                    return (
                      <button
                        key={k} type="button" role="gridcell" aria-selected={sel} disabled={past}
                        onClick={() => onChange(compose(d, fit(d, time)))}
                        aria-label={`${MONTHS[view.m]} ${i + 1}, ${view.y}`}
                        className={`relative h-9 rounded-lg text-sm font-medium tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${sel ? "" : "text-slate-300 enabled:hover:bg-slate-800"}`}
                      >
                        {sel && <span className="absolute inset-0.5 rounded-lg bg-accent" aria-hidden="true" />}
                        <span className={`relative ${sel ? "font-bold text-accent-ink" : ""}`}>{i + 1}</span>
                        {k === todayKey && !sel && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="mt-3 border-t border-slate-800 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                <input
                  type="time" aria-label="Due time" value={time} disabled={!parsed} min={dayMin}
                  onChange={(e) => parsed && e.target.value && onChange(compose(parsed.date, fit(parsed.date, e.target.value)))}
                  className="h-9 rounded-lg border border-slate-600 bg-slate-950 px-2.5 text-sm text-white outline-none! transition-colors hover:border-slate-500 focus-visible:border-accent disabled:opacity-40 [color-scheme:dark]"
                />
                {PRESETS.map(([l, t]) => (
                  <button key={t} type="button" disabled={!parsed || t < dayMin} onClick={() => parsed && onChange(compose(parsed.date, t))} className={`h-9 rounded-lg border px-2.5 text-xs font-medium transition-colors disabled:opacity-40 ${parsed && parsed.time === t ? "border-accent bg-accent/10 text-accent" : "border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"}`}>{l}</button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-400">{parsed ? "Pick a day, then the time." : "Pick a day to set a due date."}</p>
                <div className="flex shrink-0 gap-1.5">
                  {!required && <button type="button" disabled={!value} onClick={() => onChange("")} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-40">Clear</button>}
                  <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700">Done</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
