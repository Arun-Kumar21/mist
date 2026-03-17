import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "Mist – Your Self-Hosted Music Streaming App",
    template: "%s | Mist",
  },
  description:
    "Mist is a self-hosted music streaming platform. Run your own music app — upload, organise, and stream high-quality audio with seamless playback, smart playlists, and personalised recommendations. Full control, zero dependency.",
  keywords: [
    "self hosted music streaming",
    "run your own music app",
    "self hosted music player",
    "private music server",
    "music streaming platform",
    "open source music player",
    "host your own music",
    "music streaming app",
    "personal music library",
    "high quality audio streaming",
    "music recommendations",
    "upload music",
    "MIST music",
  ],
  openGraph: {
    title: "Mist – Your Self-Hosted Music Streaming App",
    description:
      "Run your own music app. Mist is a self-hosted platform for uploading, organising, and streaming high-quality audio — with smart playlists and personalised recommendations.",
    siteName: "Mist",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Mist – Self-Hosted Music Streaming Platform",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mist – Your Self-Hosted Music Streaming App",
    description:
      "Run your own music app. Self-hosted, high-quality audio streaming with smart playlists and personalised recommendations.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="font-sans antialiased"
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >

          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
