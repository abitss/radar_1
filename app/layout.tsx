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
  title: "RADAR | Continuous Competitive Intelligence for Founders",
  description: "RADAR continuously discovers competitors, watches public market changes, maps competitive proximity and turns evidence into founder decisions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><RadarShell>{children}</RadarShell></body></html>;
}
