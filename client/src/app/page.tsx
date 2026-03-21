import Navbar from "@/components/layout/Navbar/Navbar"
import Footer from "@/components/layout/Footer/Footer"
import Hero from "@/components/home/Hero/Hero"
import Cities from "@/components/home/Cities/Cities"
import ServiceTiles from "@/components/home/ServiceTiles/ServiceTiles"
import Marquee from "@/components/home/Marquee/Marquee"
import Provide from "@/components/home/Provide/Provide"


export default function HomePage() {
  return (
    <>
      {/* FIXED NAVBAR */}
      <Navbar />

      {/* MAIN CONTENT */}
      <main className="bg-black text-white pt-20">

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
        {/* FOOTER */}
        <Footer />

      </main>
    </>
  )
}