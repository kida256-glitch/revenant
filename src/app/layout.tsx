import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Revenant",
  description: "WAP, resurrected: today's web as tiny cards for feature phones.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
