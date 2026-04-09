import type { Metadata } from "next";
import BeerAssistant from "@/components/assistant/BeerAssistant";
import { Geist, Geist_Mono, IBM_Plex_Mono, Manrope } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/dashboard/ToastProvider";
import AppShell from "@/components/layout/AppShell";
import { absoluteUrl, siteConfig } from "@/lib/seo";
import FloatingCocktail from "@/components/ui/FloatingCocktail ";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const dashboardSans = Manrope({
  variable: "--font-dashboard-sans",
  subsets: ["latin"],
});

const dashboardMono = IBM_Plex_Mono({
  variable: "--font-dashboard-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  referrer: "origin-when-cross-origin",
  category: "event services",
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.siteUrl,
    siteName: siteConfig.name,
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: absoluteUrl(siteConfig.ogImage),
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [absoluteUrl(siteConfig.ogImage)],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    alternateName: siteConfig.shortName,
    url: siteConfig.siteUrl,
    logo: absoluteUrl("/logo.png"),
    email: siteConfig.email,
    telephone: siteConfig.phone,
    sameAs: [siteConfig.instagram],
    areaServed: "IN",
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.siteUrl,
    description: siteConfig.description,
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
    },
  };

  return (
    <html lang="en-IN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${dashboardSans.variable} ${dashboardMono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteSchema),
          }}
        />
        <ToastProvider>
          <AppShell>{children}</AppShell>
          {/* <Suspense fallback={null}>
            <BeerAssistant />
          </Suspense> */}
          <FloatingCocktail/>
        </ToastProvider>
      </body>
    </html>
  );
}