import type { Metadata } from "next";
import { Sora, Source_Sans_3 } from "next/font/google";

import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";

const display = Sora({ subsets: ["latin"], variable: "--font-display" });
const body = Source_Sans_3({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "MIST",
  description: "MIST streaming platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${display.variable} ${body.variable} font-sans`}>
        <div className="relative min-h-screen">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(42,128,255,0.08),transparent_48%)]" />
          <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px]">
            <AppSidebar />
            <div className="flex min-h-screen min-w-0 flex-1 flex-col">
              <SiteHeader />
              <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
