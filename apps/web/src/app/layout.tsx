import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";

import { Providers } from "@/components/Providers";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Logo } from "@/components/Logo";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Route Planner — weather along your drive",
  description:
    "Hourly weather forecast at every point of your route, graded A–F so you know what you're driving into.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        {/* Pre-hydration: apply the saved theme (or default to dark) before
            React mounts so there's no flash of light content. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'){document.documentElement.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body className="min-h-screen font-sans">
        <Providers>
          <header className="sticky top-0 z-40 glass">
            <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-3">
              <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-2.5">
                  <Logo />
                  <span className="font-semibold tracking-tight text-base">
                    Route<span className="text-gradient">Planner</span>
                  </span>
                </Link>
                <nav className="hidden gap-6 text-sm text-zinc-600 dark:text-zinc-400 md:flex">
                  <Link
                    href="/plan"
                    className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    Plan a trip
                  </Link>
                </nav>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
