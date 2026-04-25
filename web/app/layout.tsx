import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cindy - AI Art Sorceress",
  description: "Lightning-powered tips with moneydevkit",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
