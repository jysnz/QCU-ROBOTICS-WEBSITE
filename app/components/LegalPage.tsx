import Link from "next/link";

/* Shared layout for the legal pages (/privacy and /terms): a readable column, headings, and a link to the other page. */
export function LegalPage({ kicker, title, updated, children }: { kicker: string; title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-10 md:px-7 md:pt-16">
      <p className="kicker">{kicker}</p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-[-0.03em] text-white md:text-4xl">{title}</h1>
      <p className="mt-3 text-sm text-slate-400">Last updated {updated}</p>
      <div className="mt-10 space-y-10 text-[.97rem] leading-relaxed text-slate-300">{children}</div>
      <nav aria-label="Legal pages" className="mt-14 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-800 pt-6 text-sm">
        <Link href="/privacy" className="text-slate-400 underline-offset-4 hover:text-white hover:underline">Privacy Policy</Link>
        <Link href="/terms" className="text-slate-400 underline-offset-4 hover:text-white hover:underline">Terms of Service</Link>
        <Link href="/" className="text-slate-400 underline-offset-4 hover:text-white hover:underline">Back to the website</Link>
      </nav>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold text-white">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export const List = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="list-disc space-y-1.5 pl-5 marker:text-slate-600">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
);
