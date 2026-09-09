import type { Metadata } from "next";
import { RadarShell } from "@/components/radar-shell";
import "./globals.css";
import "./intelligence.css";
import "./onboarding.css";
import "./reference-dashboard.css";
import "./reference-system.css";
import "./polish-fixes.css";

export const metadata: Metadata = {
  title: "RADAR | Strategic Intelligence OS",
  description:
    "RADAR watches your market, connects meaningful changes, and turns them into strategic decisions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><RadarShell>{children}</RadarShell></body>
    </html>
  );
}
