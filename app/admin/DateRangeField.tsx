"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

/* Pick one day or a range of days on a calendar. The result is saved as the text the website already shows,
   e.g. "March 14, 2026", "March 14-15, 2026" or "March 28 - April 2, 2026" (the database reads that to set the status). */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const key = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const day = (y: number, m: number, d: number) => new Date(y, m, d);

export function formatRange(a: Date, b: Date | null): string {
  if (!b || key(a) === key(b)) return `${MONTHS[a.getMonth()]} ${a.getDate()}, ${a.getFullYear()}`;
  if (a.getFullYear() !== b.getFullYear()) return `${MONTHS[a.getMonth()]} ${a.getDate()}, ${a.getFullYear()} - ${MONTHS[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`;
  if (a.getMonth() === b.getMonth()) return `${MONTHS[a.getMonth()]} ${a.getDate()}-${b.getDate()}, ${a.getFullYear()}`;
  return `${MONTHS[a.getMonth()]} ${a.getDate()} - ${MONTHS[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`;
}

const monthIndex = (name: string) => MONTHS.findIndex((m) => m.slice(0, 3).toLowerCase() === name.slice(0, 3).toLowerCase());

export function parseRange(text: string): { start: Date; end: Date } | null {
  const t = text.trim();
  let m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),\s*(\d{4})\s*[-–]\s*([A-Za-z]{3,9})\.?\s+(\d{1,2}),\s*(\d{4})$/.exec(t);
  if (m && monthIndex(m[1]) > -1 && monthIndex(m[4]) > -1) return { start: day(+m[3], monthIndex(m[1]), +m[2]), end: day(+m[6], monthIndex(m[4]), +m[5]) };
  m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:\s*[-–]\s*(?:([A-Za-z]{3,9})\.?\s+)?(\d{1,2}))?,?\s*(\d{4})$/.exec(t);
  if (!m || monthIndex(m[1]) < 0) return null;
  const em = m[3] ? monthIndex(m[3]) : monthIndex(m[1]);
  if (em < 0) return null;
  return { start: day(+m[5], monthIndex(m[1]), +m[2]), end: day(+m[5], em, +(m[4] ?? m[2])) };
}

function statusOf(a: Date, b: Date) {
  const now = new Date();
  const today = key(day(now.getFullYear(), now.getMonth(), now.getDate()));
  if (key(b) < today) return { label: "Completed", cls: "border-slate-600 text-slate-300", dot: "bg-slate-400" };
  if (key(a) > today) return { label: "Upcoming", cls: "border-violet-400/50 text-violet-300", dot: "bg-violet-400" };
  return { label: "Active", cls: "border-accent/50 text-accent", dot: "bg-accent" };
}

export default function DateRangeField({ id, value, onChange, invalid }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const parsed = useMemo(() => parseRange(value), [value]);
  const [open, setOpen] = useState(false);
  const base = parsed?.start ?? new Date();
  const [view, setView] = useState({ y: base.getFullYear(), m: base.getMonth() });
  const [anchor, setAnchor] = useState<Date | null>(null); // first click of a range while the second is pending
  const [hover, setHover] = useState<Date | null>(null);
  const [years, setYears] = useState(false);

  const first = new Date(view.y, view.m, 1).getDay();
  const count = new Date(view.y, view.m + 1, 0).getDate();
  const todayKey = key(new Date());

  const shown = anchor ? { a: anchor, b: hover && key(hover) >= key(anchor) ? hover : anchor } : parsed ? { a: parsed.start, b: parsed.end } : null;
  const inRange = (d: Date) => !!shown && key(d) >= key(shown.a) && key(d) <= key(shown.b);

  const move = (n: number) => setView((v) => { const d = new Date(v.y, v.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const pick = (d: Date) => {
    if (!anchor) { setAnchor(d); onChange(formatRange(d, null)); return; }
    const [a, b] = key(d) < key(anchor) ? [d, anchor] : [anchor, d];
    setAnchor(null); setHover(null); onChange(formatRange(a, b));
  };
  const status = parsed ? statusOf(parsed.start, parsed.end) : null;
  const yearList = Array.from({ length: 12 }, (_, i) => new Date().getFullYear() + 3 - i);

  return (
    <div>
      <button
        type="button" id={id} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}
        className={`flex h-11 w-full items-center gap-3 rounded-xl border bg-slate-900 px-4 text-left text-sm font-medium outline-none! transition-[border-color,box-shadow] hover:border-slate-500 focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_rgba(200,245,96,.18)] focus-visible:outline-none! ${invalid ? "border-[#f87171]" : open ? "border-accent" : "border-slate-600"}`}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <span className={`min-w-0 flex-1 truncate ${value ? "text-white" : "text-slate-500"}`}>{value || "Pick a date or a range of days"}</span>
        {status && <span className={`hidden items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[.62rem] uppercase tracking-[.12em] sm:inline-flex ${status.cls}`}><span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden="true" />{status.label}</span>}
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
                  <button key={y} type="button" onClick={() => { setView((v) => ({ ...v, y })); setYears(false); }} className={`h-9 rounded-lg text-sm font-medium transition-colors ${y === view.y ? "bg-accent text-accent-ink" : "text-slate-300 hover:bg-slate-800"}`}>{y}</button>
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 text-center font-mono text-[.65rem] uppercase text-slate-500" aria-hidden="true">{DOW.map((d) => <span key={d} className="py-1">{d}</span>)}</div>
                <div className="grid grid-cols-7" role="grid" onMouseLeave={() => setHover(null)}>
                  {Array.from({ length: first }, (_, i) => <span key={`b${i}`} />)}
                  {Array.from({ length: count }, (_, i) => {
                    const d = new Date(view.y, view.m, i + 1);
                    const k = key(d);
                    const isStart = !!shown && k === key(shown.a), isEnd = !!shown && k === key(shown.b);
                    const mid = inRange(d);
                    return (
                      <button
                        key={k} type="button" role="gridcell" aria-selected={mid} onClick={() => pick(d)} onMouseEnter={() => anchor && setHover(d)}
                        aria-label={`${MONTHS[view.m]} ${i + 1}, ${view.y}`}
                        className={`relative h-9 text-sm font-medium tabular-nums transition-colors ${mid ? "bg-accent/15 text-white" : "rounded-lg text-slate-300 hover:bg-slate-800"} ${isStart ? "rounded-l-lg" : ""} ${isEnd ? "rounded-r-lg" : ""}`}
                      >
                        {(isStart || isEnd) && <span className="absolute inset-0.5 rounded-lg bg-accent" aria-hidden="true" />}
                        <span className={`relative ${isStart || isEnd ? "font-bold text-accent-ink" : ""}`}>{i + 1}</span>
                        {k === todayKey && !isStart && !isEnd && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
              <p className="text-xs text-slate-400">{anchor ? "Now click the last day, or the same day again for a one-day event." : "Click a day. For several days, click the first and then the last."}</p>
              <div className="flex shrink-0 gap-1.5">
                <button type="button" disabled={!value} onClick={() => { setAnchor(null); onChange(""); }} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-40">Clear</button>
                <button type="button" onClick={() => { setAnchor(null); setOpen(false); }} className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700">Done</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
