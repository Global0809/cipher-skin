import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "cipher.skin — Clarisse Mark II",
  description:
    "Clarisse Mark II — the AI skin diagnostic capsule for premium salon chains.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
