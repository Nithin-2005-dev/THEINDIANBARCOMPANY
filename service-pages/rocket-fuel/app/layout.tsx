import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3105";
const metadataBase = new URL(siteUrl);
const serviceName = "RocketFuel.tib";
const title = "RocketFuel.tib | After Party Bartending Services in India";
const description =
  "RocketFuel.tib by The Indian Bar Company delivers after-dark bartending, nightlife cocktail service, and premium late-night hospitality for elevated celebrations in India.";
const ogImage = "/rocket-fuel-poster.jpeg";
const logoUrl = new URL("/logo.png", metadataBase).toString();
const imageUrl = new URL(ogImage, metadataBase).toString();

export const metadata: Metadata = {
  metadataBase,
  title,
  description,
  applicationName: "The Indian Bar Company",
  referrer: "origin-when-cross-origin",
  category: "event services",
  keywords: [
    "after party bartending services India",
    "late night cocktail service",
    "nightlife bartenders India",
    "after dark event bartenders",
    "launch party cocktail catering",
    "RocketFuel.tib",
    "The Indian Bar Company",
    "premium nightlife hospitality",
    "bartenders for late night events",
    "cocktail service for after parties",
  ],
  authors: [{ name: "The Indian Bar Company" }],
  creator: "The Indian Bar Company",
  publisher: "The Indian Bar Company",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteUrl,
    siteName: "The Indian Bar Company",
    title,
    description,
    images: [
      {
        url: ogImage,
        alt: "RocketFuel.tib after-dark bartending by The Indian Bar Company",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [ogImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}#organization`,
        name: "The Indian Bar Company",
        url: siteUrl,
        logo: logoUrl,
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}#website`,
        url: siteUrl,
        name: serviceName,
        publisher: {
          "@id": `${siteUrl}#organization`,
        },
        inLanguage: "en-IN",
      },
      {
        "@type": "Service",
        "@id": `${siteUrl}#service`,
        name: serviceName,
        description,
        serviceType: "After-dark bartending and nightlife cocktail hospitality",
        areaServed: {
          "@type": "Country",
          name: "India",
        },
        provider: {
          "@id": `${siteUrl}#organization`,
        },
        image: imageUrl,
      },
      {
        "@type": "WebPage",
        "@id": `${siteUrl}#webpage`,
        url: siteUrl,
        name: title,
        description,
        isPartOf: {
          "@id": `${siteUrl}#website`,
        },
        about: {
          "@id": `${siteUrl}#service`,
        },
        primaryImageOfPage: imageUrl,
      },
    ],
  };

  return (
    <html lang="en-IN">
      <body>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </body>
    </html>
  );
}
