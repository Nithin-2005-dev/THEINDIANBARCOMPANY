import type { Metadata } from "next"
import Addons from '@/components/catalog/Addons/Addons'
import FinalCTA from '@/components/catalog/FinalCTA/FinalCTA'
import Gallery from '@/components/catalog/Gallery/Gallery'
import Packages from '@/components/catalog/Packages/Packages'
import Hero from '@/components/catalog/Hero/Hero'
import { heroes } from '@/data/heros'
import { packagesData } from '@/data/packages'
import { galleriesData } from '@/data/galleries'
import { addonsData } from '@/data/addons'
import { buildMetadata } from '@/lib/seo'
import { buildBookingHref } from '@/components/booking/booking-service-config'

export const metadata: Metadata = buildMetadata({
  title: "House Parties",
  description:
    "Explore house party bartending packages with curated cocktails, premium bar setups, and professional service for intimate celebrations and private gatherings.",
  path: "/martini",
  keywords: [
    "house party bartenders",
    "private party cocktails",
    "home bar catering",
    "bartender for house party",
  ],
  image: "/images/martini/1.jpg",
})

const page = () => {
  const bookingHref = buildBookingHref({ service: "martini" })

  return (
    <main>
      <Hero
        {...heroes.martini}
        primaryCta="Check Availability"
        primaryHref={bookingHref}
        secondaryCta="Talk to an Expert"
        secondaryHref={bookingHref}
      />
      <Packages {...packagesData.martini} serviceLabel="House Party" serviceSlug="martini" />
      <Gallery {...galleriesData.martini}/>
      <Addons {...addonsData.martini}/>
      <FinalCTA serviceLabel="House Party" serviceSlug="martini" />
    </main>
  )
}

export default page
