"use client";

import { Command } from "cmdk";
import { Dialog } from "@base-ui/react/dialog";
import { CornerDownLeft, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type PaletteItem = { id: string; label: string; group: string; icon: LucideIcon; run: () => void };

/* Ctrl/Cmd+K jump-to menu (cmdk for the filtering and arrow-key list, base-ui Dialog for focus trapping and dismissal). */
export default function CommandPalette({
  items,
  open,
  onOpenChange,
}: {
  items: PaletteItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const groups = [...new Set(items.map((i) => i.group))];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
          <Dialog.Popup className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-600 bg-slate-900 outline-none transition-[opacity,transform] duration-150 ease-out-quint data-[starting-style]:-translate-y-2 data-[starting-style]:scale-[.98] data-[starting-style]:opacity-0 data-[ending-style]:scale-[.98] data-[ending-style]:opacity-0">
            <Dialog.Title className="sr-only">Jump to</Dialog.Title>
            <Command loop label="Jump to a section or action">
              <div className="flex items-center gap-3 border-b border-slate-700 px-4">
                <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                <Command.Input
                  autoFocus
                  placeholder="Jump to a section or action…"
                  className="h-14 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                />
                <kbd className="shrink-0 rounded-md border border-slate-600 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">Esc</kbd>
              </div>
              <Command.List className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
                <Command.Empty className="py-10 text-center text-sm text-slate-400">Nothing matches that.</Command.Empty>
                {groups.map((g) => (
                  <Command.Group
                    key={g}
                    heading={g}
                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[.66rem] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[.18em] [&_[cmdk-group-heading]]:text-slate-500"
                  >
                    {items.filter((i) => i.group === g).map((i) => (
                      <Command.Item
                        key={i.id}
                        value={`${g} ${i.label}`}
                        onSelect={() => { onOpenChange(false); i.run(); }}
                        className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 outline-none data-[selected=true]:bg-slate-800 data-[selected=true]:text-white"
                      >
                        <i.icon className="h-4 w-4 shrink-0 text-slate-500 group-data-[selected=true]:text-accent" aria-hidden="true" />
                        <span className="flex-1 truncate">{i.label}</span>
                        <CornerDownLeft className="h-3.5 w-3.5 text-slate-500 opacity-0 group-data-[selected=true]:opacity-100" aria-hidden="true" />
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))}
              </Command.List>
            </Command>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
