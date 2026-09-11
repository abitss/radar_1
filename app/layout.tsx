import type { Metadata } from "next";
import { RadarShell } from "@/components/radar-shell";
import "./globals.css";
import "./intelligence.css";
import "./onboarding.css";
import "./reference-dashboard.css";
import "./reference-system.css";
import "./polish-fixes.css";
import "./navigation-simplify.css";
import "./founder-os.css";
import "./functional-radar.css";

export const metadata: Metadata = {
  title: "RADAR | Founder Intelligence OS",
  description:
    "RADAR helps founders see customer truth, market change, runway risk and critical decisions before they become urgent.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><RadarShell>{children}</RadarShell></body>
    </html>
  );
}
