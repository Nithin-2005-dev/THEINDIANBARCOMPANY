import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3104";
const metadataBase = new URL(siteUrl);
const logoUrl = new URL("/logo.png", metadataBase).toString();
const title = "BloodyMary.tib | Festivals | The Indian Bar Company";
const description =
  "BloodyMary.tib by The Indian Bar Company. Festival-ready cocktails, public event bars, and premium large-format hospitality. Coming soon.";

export const metadata: Metadata = {
  metadataBase,
  title,
  description,
  applicationName: "The Indian Bar Company",
  keywords: [
    "BloodyMary.tib",
    "The Indian Bar Company",
    "festivals",
    "public events",
    "event bartending",
    "premium hospitality",
  ],
  authors: [{ name: "The Indian Bar Company" }],
  creator: "The Indian Bar Company",
  publisher: "The Indian Bar Company",
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
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "The Indian Bar Company logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title,
    description,
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: siteUrl,
    image: logoUrl,
    about: {
      "@type": "Service",
      name: "BloodyMary.tib",
      serviceType: "Festival bartending and public event cocktail hospitality",
      provider: {
        "@type": "Organization",
        name: "The Indian Bar Company",
        url: siteUrl,
        logo: {
          "@type": "ImageObject",
          url: logoUrl,
        },
      },
    },
    publisher: {
      "@type": "Organization",
      name: "The Indian Bar Company",
      logo: {
        "@type": "ImageObject",
        url: logoUrl,
      },
    },
  };

  return (
    <html lang="en">
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
