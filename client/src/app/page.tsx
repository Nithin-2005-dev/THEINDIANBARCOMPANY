import type { Metadata } from "next"
import Hero from "@/components/home/Hero/Hero"
import Cities from "@/components/home/Cities/Cities"
import ServiceTiles from "@/components/home/ServiceTiles/ServiceTiles"
import Marquee from "@/components/home/Marquee/Marquee"
import Provide from "@/components/home/Provide/Provide"
import HomeTestimonials from "@/components/home/HomeTestimonials/HomeTestimonials"
import HomeHowItWorks from "@/components/home/HowItWorks/HomeHowItWorks"
import { buildMetadata } from "@/lib/seo"

export const metadata: Metadata = buildMetadata({
  title: "The Indian Bar",
  description:
    "Book premium bartenders, cocktail catering, and event bar setups for house parties, pool parties, corporate events, and festivals across India.",
  path: "/",
  keywords: [
    "party bartenders",
    "cocktail catering India",
    "corporate event bartenders",
    "festival bar services",
    "mobile bar India",
  ],
  image: "/images/cosmo/1.jpg",
})


export default function HomePage() {
  return (
    <>

      {/* MAIN CONTENT */}
      <main className="bg-black text-white">

        {/* HERO */}
        <Hero />
        {/* Cities */}
        <Cities />
        {/* Services Tiles */}
        <ServiceTiles />
        {/* Marquee */}
        <Marquee />
        {/*Provide*/}
        <Provide />
        <HomeHowItWorks/>
        <HomeTestimonials/>
      </main>
    </>
  )
}
