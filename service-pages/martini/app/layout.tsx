import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3101";
const metadataBase = new URL(siteUrl);
const serviceName = "Martini.tib";
const title = "Martini.tib | House Party Bartending Services in India";
const description =
  "Martini.tib by The Indian Bar Company delivers luxury house party bartending, private cocktail service, and premium home-hosting experiences in India.";
const ogImage = "/martini-poster.jpeg";
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
    "house party bartending services India",
    "private bartender for home party",
    "luxury house party cocktails",
    "home cocktail catering India",
    "private mixologist India",
    "Martini.tib",
    "The Indian Bar Company",
    "premium bartending services",
    "event bartenders India",
    "cocktail experience at home",
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
        alt: "Martini.tib luxury house party bartending by The Indian Bar Company",
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
        serviceType: "Luxury house party bartending and private cocktail hospitality",
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
