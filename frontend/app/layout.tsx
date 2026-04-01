import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
