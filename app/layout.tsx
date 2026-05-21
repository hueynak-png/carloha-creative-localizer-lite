import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Carloha Creative Localizer Lite",
  description: "Internal manual poster localization workflow for Carloha design team"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
