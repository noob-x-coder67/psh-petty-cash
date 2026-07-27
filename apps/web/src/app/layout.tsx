import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { TooltipProvider } from "@psh/ui";
import { QueryProvider } from "../components/providers/query-provider";
import "./globals.css";

// "Aptos/Inter-style sans" (SRS §11.4) — Inter itself, self-hosted via next/font so
// there's no runtime request to Google Fonts, bound to --font-sans-override which
// tokens.css's --font-sans falls back to.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans-override" });

export const metadata = {
  title: "PSH Petty Cash",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <QueryProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
