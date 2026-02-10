// ===============================
// app/layout.tsx (RootLayout)
// - Keeps your fonts and theme, adds minor polish and safe defaults
// ===============================

import { Public_Sans } from "next/font/google";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { ApplyThemeScript, ThemeToggle } from "@/components/theme-toggle";
import { getAppConfig } from "@/lib/utils";
import { AuthProvider } from "@/providers/AuthProvider";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

const commitMono = localFont({
  src: [
    {
      path: "./fonts/CommitMono-400-Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/CommitMono-700-Regular.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/CommitMono-400-Italic.otf",
      weight: "400",
      style: "italic",
    },
    {
      path: "./fonts/CommitMono-700-Italic.otf",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-commit-mono",
});

export const metadata = {
  title: "Miss Muggy AI",
  description: "Learn with miss muggy",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hdrs = await headers();
  const { accent, accentDark, pageTitle, pageDescription } =
    await getAppConfig(hdrs);

  const styles = [
    accent ? `:root { --primary: ${accent}; }` : "",
    accentDark ? `.dark { --primary: ${accentDark}; }` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="scroll-smooth"
    >
      <head>
        {styles && <style>{styles}</style>}
        <title>{pageTitle}</title>
        <meta
          name="description"
          content={pageDescription}
        />
        <ApplyThemeScript />
      </head>
      <body
        className={`${publicSans.variable} ${commitMono.variable} overflow-x-hidden antialiased`}
      >
        <AuthProvider>
          <div className="min-h-dvh bg-background text-foreground">
            <div
              className="pointer-events-none fixed inset-0 -z-10 select-none opacity-[0.03]"
              aria-hidden
            >
              {/* subtle texture / grid, optional via CSS background-image in globals */}
            </div>
            {children}
          </div>
        </AuthProvider>

        {/* Floating theme toggle */}
        <div className="group fixed bottom-0 left-1/2 z-50 mb-2 -translate-x-1/2">
          <ThemeToggle className="translate-y-20 transition-transform delay-150 duration-300 group-hover:translate-y-0" />
        </div>
      </body>
    </html>
  );
}
