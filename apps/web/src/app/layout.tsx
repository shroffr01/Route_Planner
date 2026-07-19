import "./globals.css";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";

import { Providers } from "@/components/Providers";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Logo } from "@/components/Logo";

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Route Planner — weather along your drive",
  description:
    "Hourly weather forecast at every point of your route, graded A–F so you know what you're driving into.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={font.variable}>
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
                  <span className="font-semibold tracking-tight text-base text-zinc-900 dark:text-zinc-50">
                    RoutePlanner
                  </span>
                </Link>
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
