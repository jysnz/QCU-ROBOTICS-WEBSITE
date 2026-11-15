import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import "./scrollbars.css";
import Splash from "./components/Splash";
import SiteHeader from "./components/SiteHeader";
import SiteEffects from "./components/SiteEffects";
import SessionExpiredModal from "./components/SessionExpiredModal";

const inter = Inter({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });
const grotesk = Space_Grotesk({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"], display: "swap" });

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.qcurobotics.website';

export const viewport: Viewport = {
  themeColor: "#0a0b0f",
};

export const metadata: Metadata = {
  title: {
    default: "QCU Robotics | Quezon City University Robotics Team",
    template: "%s | QCU Robotics",
  },
  description:
    "QCU Robotics is the robotics team of Quezon City University. See our competitions, match results, achievements and the people behind the team.",
  applicationName: "QCU Robotics",
  alternates: { canonical: "/" },
  metadataBase: new URL(BASE_URL),
  keywords: [
    "QCU Robotics",
    "Quezon City University",
    "robotics team",
    "robotics competitions",
    "Philippines robotics",
  ],
  authors: [{ name: "QCU Robotics" }],
  openGraph: {
    type: "website",
    locale: "en_PH",
    url: BASE_URL,
    siteName: "QCU Robotics",
    title: "QCU Robotics | Quezon City University Robotics Team",
    description:
      "The robotics team of Quezon City University: competitions, match results, achievements and our team.",
    images: [{ url: "/logo.png", width: 640, height: 640, alt: "QCU Robotics logo" }],
  },
  twitter: {
    card: "summary",
    title: "QCU Robotics | Quezon City University Robotics Team",
    description:
      "The robotics team of Quezon City University: competitions, match results, achievements and our team.",
    images: ["/logo.png"],
  },
  // Google wants a favicon whose size is a multiple of 48 px (the old 1.4 MB SVG is too heavy for it), so offer small PNGs first.
  icons: {
    icon: [
      { url: "/logo-96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/logo.png", sizes: "640x640", type: "image/png" }],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // "intro flying" hides the page + header logo until the splash hands off (removed in <Splash>)
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${grotesk.variable} intro flying h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Tells Google the site's name and logo, so results show "QCU Robotics" and the logo instead of the bare domain. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              { "@context": "https://schema.org", "@type": "WebSite", name: "QCU Robotics", alternateName: ["QCUR", "QCU Robotics Team"], url: BASE_URL },
              { "@context": "https://schema.org", "@type": "Organization", name: "QCU Robotics", url: BASE_URL, logo: `${BASE_URL}/logo.png` },
            ]),
          }}
        />
        <Splash />
        <div className="site-bg" aria-hidden="true" />
        <div id="site" className="flex min-h-screen flex-col">
          <SiteHeader />
          <div className="flex-1">{children}</div>
        </div>
        <SiteEffects />
        <SessionExpiredModal />
        {/* What people see if they open the browser console (see public/console-warning.js). */}
        <Script src="/console-warning.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
