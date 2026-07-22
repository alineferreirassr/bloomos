import type { Metadata } from "next";
import { Cormorant_Garamond, Lora } from "next/font/google";
import { initializeCore } from "@/core/initializeCore";
import { CoreClientInitializer } from "@/core/components/CoreClientInitializer";
import "./globals.css";

initializeCore();

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-lora",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Amoré Bloom",
  description: "Amoré Bloom — Luxury Proposal & Event Studio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${lora.variable} ${cormorant.variable}`}>
      <body>
        <CoreClientInitializer />
        {children}
      </body>
    </html>
  );
}
