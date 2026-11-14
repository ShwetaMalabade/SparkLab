import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { getMode, type Mode } from "@/lib/client/mode";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Homework Arena",
  description: "Snap a worksheet. Play it as a 3D lab with your hands. AI writes, code checks.",
};

const PILL: Record<Mode, { label: string; className: string }> = {
  live: { label: "● LIVE", className: "border-lime/50 text-lime" },
  mock: { label: "◆ MOCK", className: "border-amber/50 text-amber" },
  offline: { label: "■ OFFLINE · REPLAY", className: "border-violet/50 text-violet" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const pill = PILL[getMode()];
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <div
          aria-label="Data mode"
          className={`pointer-events-none fixed left-3 top-3 z-50 rounded-full border bg-navy/80 px-3 py-1 text-xs font-semibold tracking-wider backdrop-blur ${pill.className}`}
        >
          {pill.label}
        </div>
        {children}
      </body>
    </html>
  );
}
