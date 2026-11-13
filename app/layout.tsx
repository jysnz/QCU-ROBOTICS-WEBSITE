import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import "./scrollbars.css";
import Splash from "./components/Splash";
import SiteHeader from "./components/SiteHeader";
import SiteEffects from "./components/SiteEffects";

const inter = Inter({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });
const grotesk = Space_Grotesk({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"], display: "swap" });

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://qcu-robotics.vercel.app';

export const viewport: Viewport = {
  themeColor: "#0a0b0f",
};

export const metadata: Metadata = {
  title: {
    default: "QCU Robotics",
    template: "%s | QCU Robotics",
  },
  description:
    "Official website of QCU Robotics — the robotics team of Quezon City University. Competitions, achievements, team members, and more.",
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
    title: "QCU Robotics",
    description:
      "Official website of QCU Robotics — the robotics team of Quezon City University.",
  },
  twitter: {
    card: "summary_large_image",
    title: "QCU Robotics",
    description:
      "Official website of QCU Robotics — the robotics team of Quezon City University.",
  },
  icons: {
    icon: "/logo1.svg",
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
        <Splash />
        <div className="site-bg" aria-hidden="true" />
        <div id="site" className="flex min-h-screen flex-col">
          <SiteHeader />
          <div className="flex-1">{children}</div>
        </div>
        <SiteEffects />
      </body>
    </html>
  );
}
