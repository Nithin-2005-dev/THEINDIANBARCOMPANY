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

export const metadata: Metadata = buildMetadata({
  title: "Corporate Events",
  description:
    "Plan polished corporate event bar experiences with branded cocktails, premium service staff, and tailored beverage programs for launches, mixers, and business events.",
  path: "/cosmo",
  keywords: [
    "corporate event bartenders",
    "cocktail catering for offices",
    "brand event bar setup",
    "corporate party bar services",
  ],
  image: "/images/cosmo/1.jpg",
})

const page = () => {
  return (
    <main>
      <Hero {...heroes.cosmo}/>
      <Packages {...packagesData.cosmo}/>
      <Gallery {...galleriesData.cosmo}/>
      <Addons {...addonsData.cosmo}/>
      <FinalCTA/>
    </main>
  )
}

export default page
