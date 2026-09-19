import type { Metadata } from "next";
import { Cormorant_Garamond, Lora, Manrope } from "next/font/google";
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

// GLOBAL-VISUAL-04 addendum — AF Digital Studio OS's own real interface
// sans (app/layout.tsx, HEAD 1587d1f: "body, forms, tables, navigation,
// dense operational content"), added for CRM-scoped use only. NOT wired
// into the shared --font-body-family/--font-sans tokens: those also back
// Dashboard's own Luxury shell (--luxury-font-body resolves to the same
// variable), and changing them would be a Dashboard redesign, which stays
// explicitly out of scope. See --font-crm-sans in globals.css.
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
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
    <html lang="en" className={`${lora.variable} ${cormorant.variable} ${manrope.variable}`}>
      <body>
        <CoreClientInitializer />
        {children}
      </body>
    </html>
  );
}
