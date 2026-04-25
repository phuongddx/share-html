import type { Metadata } from "next";
import { Ubuntu, Ubuntu_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthUserMenu } from "@/components/auth-user-menu";
import Link from "next/link";
import "./globals.css";

const ubuntuSans = Ubuntu({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const ubuntuMono = Ubuntu_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "DropItX",
  description: "Instant file drops, shareable links.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${ubuntuSans.variable} ${ubuntuMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
            <div className="flex items-center justify-between h-12 px-4 max-w-7xl mx-auto">
              <Link href="/" className="font-mono text-lg font-bold tracking-tight">
                [x]{" "}<span className="text-violet-600 dark:text-violet-400">dropitx</span>
              </Link>
              <AuthUserMenu />
            </div>
          </header>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
