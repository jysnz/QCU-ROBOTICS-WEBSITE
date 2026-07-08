import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://qcu-robotics.vercel.app';

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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
