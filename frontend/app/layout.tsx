import type { Metadata } from "next";
import { Geist, Manrope } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const dashboardSans = Manrope({
  variable: "--font-dashboard-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Indian Bar Company",
  description:
    "Luxury cocktail experiences for house parties, pool parties, corporate events, festivals, and after-dark celebrations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${dashboardSans.variable}`}>{children}</body>
    </html>
  );
}
