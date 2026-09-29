import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { env } from "@/env.mjs";

import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

import { ConvexClientProvider } from "./convex-client-provider";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";

import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE, LANGUAGES } from "@/lib/languages";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: "Sahayak — Cooperative Governance Assistant",
  description:
    "Multilingual AI assistant for cooperative members, farmers and rural stakeholders — cooperative laws, government schemes, PMFBY crop insurance, financial literacy and grievance redressal in 22 Indian languages.",
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Sahayak — Cooperative Governance Assistant",
    description:
      "Multilingual AI assistant for cooperative members and farmers — laws, schemes, PMFBY, financial literacy and grievance redressal.",
    siteName: "Sahayak",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  applicationName: "Sahayak",
  appleWebApp: {
    capable: true,
    title: "Sahayak",
    statusBarStyle: "default",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sahayak — Cooperative Governance Assistant",
    description:
      "Multilingual AI assistant for cooperative members and farmers — laws, schemes, PMFBY, financial literacy and grievance redressal.",
    images: ["/api/og"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#15803d" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieLang = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  const lang = LANGUAGES.some((l) => l.code === cookieLang)
    ? (cookieLang as string)
    : DEFAULT_LANGUAGE;

  return (
    <html lang={lang} suppressHydrationWarning>
      <ConvexAuthNextjsServerProvider>
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ConvexClientProvider initialLang={lang}>{children}</ConvexClientProvider>
            <Toaster />
          </ThemeProvider>
        </body>
      </ConvexAuthNextjsServerProvider>
    </html>
  );
}
