import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Magna-Mind",
  description: "AI-powered magnetic tile building guide for Playmager and Magna-Tiles."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
