import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BloomOS",
  description: "The operating system for luxury event businesses.",
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
