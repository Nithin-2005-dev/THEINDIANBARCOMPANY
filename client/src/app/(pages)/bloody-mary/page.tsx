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
  title: "Festivals",
  description:
    "Discover high-capacity festival and large event bar services with multiple stations, VIP setups, branded experiences, and full beverage operations support.",
  path: "/bloody-mary",
  keywords: [
    "festival bartenders",
    "large event bar services",
    "event beverage operations",
    "VIP bar setup",
  ],
  image: "/images/bm/1.jpg",
})

const page = () => {
  const bookingHref = buildBookingHref({ service: "festival" })

  return (
    <main>
      <Hero
        {...heroes.bm}
        primaryCta="Check Availability"
        primaryHref={bookingHref}
        secondaryCta="Talk to an Expert"
        secondaryHref={bookingHref}
      />
      <Packages {...packagesData.bm} serviceLabel="Festival Event" serviceSlug="festival" />
      <Gallery {...galleriesData.bm}/>
      <Addons {...addonsData.bm}/>
      <FinalCTA serviceLabel="Festival Event" serviceSlug="festival" />
    </main>
  )
}

export default page
