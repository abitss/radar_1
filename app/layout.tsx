import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RADAR | Strategic Intelligence OS",
  description:
    "RADAR watches your market, connects meaningful changes, and turns them into strategic decisions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
