// A template remounts on every navigation, so the page fades up each time you change route.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
