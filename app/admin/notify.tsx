"use client";

import { toast } from "sonner";
import { AlertTriangle, Info, Pencil, Plus, Trash2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* The mini message box shown at the bottom right whenever something is added, edited or deleted.
   Built on Sonner (stacking, swipe to dismiss, pause on hover) with our own look: a coloured icon, a headline
   ("Added", "Updated", "Deleted"), the item's name, an optional Undo button and a bar that counts down. */
type Kind = "created" | "updated" | "deleted" | "error" | "info";
type Options = { description?: string; action?: { label: string; onClick: () => void } };

const KIND: Record<Kind, { icon: LucideIcon; color: string; eyebrow: string; ms: number }> = {
  created: { icon: Plus, color: "#c8f560", eyebrow: "Added", ms: 4000 },
  updated: { icon: Pencil, color: "#7dd3fc", eyebrow: "Updated", ms: 4000 },
  deleted: { icon: Trash2, color: "#f87171", eyebrow: "Deleted", ms: 6000 }, // longer when there's an Undo
  error: { icon: AlertTriangle, color: "#fbbf24", eyebrow: "Something went wrong", ms: 7000 },
  info: { icon: Info, color: "#94a3b8", eyebrow: "Note", ms: 4000 },
};

function Box({ id, kind, title, opts }: { id: string | number; kind: Kind; title: string; opts: Options }) {
  const k = KIND[kind];
  const Icon = k.icon;
  return (
    <div role={kind === "error" ? "alert" : "status"} className="notify relative w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-600 bg-slate-900 p-3.5 pb-4 shadow-[0_12px_40px_rgba(0,0,0,.55)]">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: `${k.color}1f`, color: k.color }}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[.62rem] uppercase tracking-[.16em]" style={{ color: k.color }}>{k.eyebrow}</p>
          <p className="mt-0.5 break-words text-sm font-medium leading-snug text-white">{title}</p>
          {opts.description && <p className="mt-0.5 break-words text-xs leading-snug text-slate-400">{opts.description}</p>}
          {opts.action && (
            <button type="button" onClick={() => { opts.action!.onClick(); toast.dismiss(id); }} className="mt-2 rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:border-slate-400">
              {opts.action.label}
            </button>
          )}
        </div>
        <button type="button" onClick={() => toast.dismiss(id)} aria-label="Dismiss" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-800 hover:text-white">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      <span className="notify-bar" style={{ background: k.color, animationDuration: `${opts.action ? Math.max(k.ms, 8000) : k.ms}ms` }} aria-hidden="true" />
    </div>
  );
}

function show(kind: Kind, title: string, opts: Options = {}) {
  const ms = opts.action ? Math.max(KIND[kind].ms, 8000) : KIND[kind].ms;
  return toast.custom((id) => <Box id={id} kind={kind} title={title} opts={opts} />, { duration: ms });
}

export const notify = {
  created: (title: string, opts?: Options) => show("created", title, opts),
  updated: (title: string, opts?: Options) => show("updated", title, opts),
  deleted: (title: string, opts?: Options) => show("deleted", title, opts),
  error: (title: string, opts?: Options) => show("error", title, opts),
  info: (title: string, opts?: Options) => show("info", title, opts),
};
