import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { Toaster, TooltipProvider } from "@psh/ui";
import { QueryProvider } from "../components/providers/query-provider";
import { ThemeProvider } from "../components/providers/theme-provider";
import "./globals.css";

// "Aptos/Inter-style sans" (SRS §11.4) — Inter itself, self-hosted via next/font so
// there's no runtime request to Google Fonts, bound to --font-sans-override which
// tokens.css's --font-sans falls back to.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans-override" });

export const metadata = {
  title: "PSH Petty Cash",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/icon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

// Runs before hydration (blocking, in <head>) so <html> already carries the right
// data-theme attribute by the time CSS paints — this is what prevents a flash of the
// wrong theme (ADR-0004). Kept intentionally tiny and dependency-free: this executes
// before any bundle has loaded.
const NO_FLASH_THEME_SCRIPT = `
(function () {
  try {
    var stored = window.localStorage.getItem("psh-theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      {/* suppressHydrationWarning here (not just on <html>) because browser extensions
          (e.g. ColorZilla's cz-shortcut-listen) inject attributes onto <body> before
          React hydrates — a real mismatch, but one that's benign and outside this app's
          control, not a bug in the render output itself. */}
      <body suppressHydrationWarning>
        <ThemeProvider>
          <QueryProvider>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
