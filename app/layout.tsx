import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";
import "./globals.css";

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Commander Copilot — MTG deckbuilding assistant",
  description:
    "An AI assistant for building Magic: The Gathering Commander decks — upgrades, mana-curve optimization, and card recommendations.",
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <ClerkProvider>
      {/* data-astryx-theme is set server-side so the theme's scoped CSS
          applies on first paint (the Theme provider re-syncs it after
          hydration). */}
      <html className={cn(sans.variable, mono.variable)} data-astryx-theme="neutral" lang="en">
        <body>
          <Providers>
            <TooltipProvider>{children}</TooltipProvider>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
