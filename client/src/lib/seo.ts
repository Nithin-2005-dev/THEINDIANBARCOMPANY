import type { Metadata } from "next";

const fallbackSiteUrl = "https://www.theindianbarcompany.com";

const normalizedSiteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || fallbackSiteUrl
).replace(/\/$/, "");

export const siteConfig = {
  name: "The Indian Bar",
  shortName: "TIB",
  description:
    "Premium bartending and cocktail catering for house parties, pool parties, corporate events, and festivals across India.",
  siteUrl: normalizedSiteUrl,
  ogImage: "/images/martini/1.jpg",
  email: "support@theindianbarcompany.com",
  phone: "+91 78968 30724",
  alternatePhone: "+91 81791 33593",
  location: "India",
  instagram:
    "https://www.instagram.com/theindianbarcompany?igsh=ZjRheXRub2llb3Vn",
};

export function absoluteUrl(path = "/") {
  return new URL(path, `${siteConfig.siteUrl}/`).toString();
}

type MetadataInput = {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  image?: string;
  noIndex?: boolean;
};

export function buildMetadata({
  title,
  description,
  path = "/",
  keywords = [],
  image = siteConfig.ogImage,
  noIndex = false,
}: MetadataInput): Metadata {
  const canonicalUrl = absoluteUrl(path);
  const fullTitle =
    title === siteConfig.name ? title : `${title} | ${siteConfig.name}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    keywords: [
      "The Indian Bar",
      "bartending services India",
      "cocktail catering",
      "event bar services",
      ...keywords,
    ],
    openGraph: {
      title: fullTitle,
      description,
      url: canonicalUrl,
      siteName: siteConfig.name,
      locale: "en_IN",
      type: "website",
      images: [
        {
          url: absoluteUrl(image),
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [absoluteUrl(image)],
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false,
          },
        }
      : {
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
  };
}
