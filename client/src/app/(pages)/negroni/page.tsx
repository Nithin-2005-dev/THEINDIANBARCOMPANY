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
  title: "Pool Parties",
  description:
    "Book pool party bartending packages with tropical cocktails, premium glassware, stylish bar setups, and service designed for vibrant summer celebrations.",
  path: "/negroni",
  keywords: [
    "pool party bartender",
    "poolside cocktail catering",
    "summer party bartenders",
    "luxury pool party bar",
  ],
  image: "/images/negroni/1.jpg",
})

const page = () => {
  const bookingHref = buildBookingHref({ service: "negroni" })

  return (
    <main >
      <Hero
        {...heroes.negroni}
        primaryCta="Check Availability"
        primaryHref={bookingHref}
        secondaryCta="Talk to an Expert"
        secondaryHref={bookingHref}
      />
      <Packages {...packagesData.negroni} serviceLabel="Pool Party" serviceSlug="negroni" />
      <Gallery {...galleriesData.negroni}/>
      <Addons {...addonsData.negroni}/>
      <FinalCTA serviceLabel="Pool Party" serviceSlug="negroni" />
    </main>
  )
}

export default page
