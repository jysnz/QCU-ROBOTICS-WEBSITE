import { Globe } from "lucide-react";
import type { ReactNode } from "react";

/* Brand tiles for the social platforms the footer knows about (lucide has no brand logos, so these are inline SVGs:
   the same marks the site footer uses, plus TikTok and Discord). Anything else gets a neutral globe. */
const FILL = { fill: "currentColor" } as const;
const mark = (d: string) => <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[55%] w-[55%]" {...FILL}><path d={d} /></svg>;

const ICONS: { test: RegExp; bg: string; fg: string; icon: ReactNode }[] = [
  { test: /facebook|^fb$/i, bg: "#1877F2", fg: "#fff", icon: mark("M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.3-1.5 1.6-1.5H16V4.6c-.3 0-1.2-.1-2.2-.1-2.2 0-3.8 1.3-3.8 3.8V11H7.6V14H10v8h3.5z") },
  { test: /instagram|^ig$/i, bg: "linear-gradient(45deg,#f9a03f 0%,#e6403c 40%,#c1308f 75%,#6a43d8 100%)", fg: "#fff", icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-[55%] w-[55%]">
      <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>) },
  { test: /youtube|^yt$/i, bg: "#FF0000", fg: "#fff", icon: mark("M21.6 8.2s-.2-1.4-.8-2c-.8-.8-1.7-.8-2.1-.9C16 5 12 5 12 5h0s-4 0-6.7.3c-.4 0-1.3.1-2.1.9-.6.6-.8 2-.8 2S2 9.8 2 11.3v1.4C2 14.2 2.4 15.6 2.4 15.6s.2 1.4.8 2c.8.8 1.8.8 2.2.9 1.6.1 6.6.2 6.6.2s4 0 6.7-.3c.4 0 1.3-.1 2.1-.9.6-.6.8-2 .8-2s.4-1.4.4-2.9v-1.4c0-1.5-.4-2.9-.4-2.9ZM10 15V9l5.2 3-5.2 3Z") },
  { test: /tiktok/i, bg: "#010101", fg: "#fff", icon: mark("M16.6 3c.3 2.4 1.7 3.9 4 4.1v3c-1.4.1-2.7-.3-4-1.1v6.1c0 3.9-3.2 6.4-6.5 5.7-2.4-.5-4.2-2.7-4.1-5.3.1-3 2.7-5.2 5.8-4.8v3.2c-1.5-.5-3.1.5-3.1 2 0 1.2 1 2.1 2.1 2 1.1 0 2-.9 2-2.1V3h3.8Z") },
  { test: /linkedin/i, bg: "#0A66C2", fg: "#fff", icon: mark("M6.94 6.5A1.94 1.94 0 1 1 3.06 6.5a1.94 1.94 0 0 1 3.88 0ZM3.5 9h3v12h-3V9Zm5 0h2.9v1.6h.1c.4-.8 1.5-1.7 3.1-1.7 3.3 0 3.9 2.2 3.9 5V21h-3v-6.2c0-1.5 0-3.5-2.1-3.5s-2.4 1.6-2.4 3.4V21h-3V9Z") },
  { test: /github/i, bg: "#24292f", fg: "#fff", icon: mark("M12 .8A11.2 11.2 0 0 0 8.5 22.6c.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.2-3.4-1.2-.4-1-.9-1.3-.9-1.3-.7-.5.1-.5.1-.5.8.1 1.3.8 1.3.8.7 1.3 1.9.9 2.4.7.1-.6.3-.9.5-1.1-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7 3.6 3.6 0 0 1 .1-2.6s.8-.2 2.7 1a9.2 9.2 0 0 1 5 0c1.9-1.2 2.7-1 2.7-1a3.6 3.6 0 0 1 .1 2.6 3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.6 5 .3.3.6.8.6 1.6v2.4c0 .3.2.6.7.5A11.2 11.2 0 0 0 12 .8Z") },
  { test: /discord/i, bg: "#5865F2", fg: "#fff", icon: mark("M19.3 5.4A16.5 16.5 0 0 0 15.2 4l-.5 1a15 15 0 0 0-4.5 0l-.5-1a16.5 16.5 0 0 0-4.1 1.4C2.9 9.2 2.2 12.9 2.5 16.5a16.6 16.6 0 0 0 5 2.5l1.1-1.7c-.6-.2-1.2-.5-1.7-.9l.4-.3a11.8 11.8 0 0 0 10.2 0l.4.3c-.5.4-1.1.7-1.7.9l1.1 1.7a16.6 16.6 0 0 0 5-2.5c.4-4.2-.7-7.9-2.9-11.1ZM9.3 14.3c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm5.4 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z") },
  { test: /twitter|^x$|^x \(/i, bg: "#0f1419", fg: "#fff", icon: mark("M18.9 3H21l-6.9 7.9L22 21h-6.8l-5.3-6.1L4.6 21H2.5l7.4-8.5L2 3h6.9l4.8 5.5L18.9 3Zm-1.2 16h1.9L8.1 4.9H6L17.7 19Z") },
];

export default function SocialIcon({ name, className = "h-12 w-12 rounded-xl" }: { name: string; className?: string }) {
  const b = ICONS.find((i) => i.test.test(name.trim()));
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden ring-1 ring-white/10 ${className}`} style={{ background: b?.bg ?? "#334155", color: b?.fg ?? "#e2e8f0" }} aria-hidden="true">
      {b ? b.icon : <Globe className="h-[50%] w-[50%]" />}
    </span>
  );
}
