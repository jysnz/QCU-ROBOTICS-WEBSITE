"use client";

import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";

export type DropdownItem = { label: string; value: string; /** Items sharing a group are listed under one heading (keep them adjacent). */ group?: string };

/* Accessible dropdown (base-ui Select): keyboard + typeahead, focus management and outside-click
   dismissal come from the primitive; this file only holds the site's styling. */
export default function Dropdown({
  label,
  items,
  value,
  onValueChange,
  placeholder = "Select…",
  disabled,
  className = "",
  hideLabel = false,
}: {
  label: string;
  items: DropdownItem[];
  value: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Keep the label for screen readers only and use a flat 44px trigger (for toolbars where controls sit in one row). */
  hideLabel?: boolean;
}) {
  return (
    <Select.Root
      items={items}
      value={value}
      onValueChange={(v) => { if (v !== null) onValueChange(v as string); }}
      disabled={disabled}
    >
      <div className={`flex flex-col ${hideLabel ? "" : "gap-2"} ${className}`}>
        <Select.Label className={hideLabel ? "sr-only" : "font-mono text-[.7rem] font-medium uppercase tracking-[.16em] text-slate-400"}>
          {label}
        </Select.Label>
        <Select.Trigger className={`group flex w-full items-center justify-between gap-3 rounded-xl border bg-slate-900 px-4 ${hideLabel ? "h-11 border-transparent hover:border-slate-600" : "h-12 border-slate-600"} text-left text-sm font-medium text-white outline-none transition-colors duration-150 hover:border-slate-500 focus-visible:border-accent data-[popup-open]:border-accent data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50`}>
          <Select.Value className="truncate data-[placeholder]:text-slate-400" placeholder={placeholder} />
          <Select.Icon className="text-slate-400 transition-transform duration-200 group-data-[popup-open]:rotate-180 group-data-[popup-open]:text-accent">
            <ChevronDown className="h-4 w-4" />
          </Select.Icon>
        </Select.Trigger>
      </div>
      <Select.Portal>
        <Select.Positioner className="z-50 outline-none" sideOffset={8} alignItemWithTrigger={false}>
          <Select.Popup className="min-w-[var(--anchor-width)] max-w-[min(32rem,calc(100vw-2rem))] origin-[var(--transform-origin)] rounded-xl border border-slate-600 bg-slate-900 p-1 outline-none transition-[opacity,transform] duration-150 ease-out-quint data-[starting-style]:scale-[.97] data-[starting-style]:opacity-0 data-[ending-style]:scale-[.97] data-[ending-style]:opacity-0">
            <Select.List className="max-h-[min(20rem,var(--available-height))] overflow-y-auto">
              {(() => {
                const render = (item: DropdownItem) => (
                  <Select.Item
                    key={item.value}
                    value={item.value}
                    className="grid cursor-default select-none grid-cols-[1fr_1rem] items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 outline-none transition-colors duration-100 data-[highlighted]:bg-slate-800 data-[highlighted]:text-white data-[selected]:text-accent"
                >
                      <Select.ItemText className="truncate">{item.label}</Select.ItemText>
                      <Select.ItemIndicator>
                      <Check className="h-4 w-4" />
                    </Select.ItemIndicator>
                </Select.Item>
                );
                if (!items.some((i) => i.group)) return items.map(render);
                // grouped: a small heading per group, in the order the groups first appear
                const names = [...new Set(items.map((i) => i.group ?? ""))];
                return names.map((g) => (
                  <Select.Group key={g || "none"}>
                    {g && <Select.GroupLabel className="px-3 pb-1 pt-3 font-mono text-[.64rem] uppercase tracking-[.16em] text-slate-500">{g}</Select.GroupLabel>}
                    {items.filter((i) => (i.group ?? "") === g).map(render)}
                  </Select.Group>
                ));
              })()}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
