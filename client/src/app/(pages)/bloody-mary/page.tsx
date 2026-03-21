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
  return (
    <main>
      <Hero {...heroes.bm}/>
      <Packages {...packagesData.bm}/>
      <Gallery {...galleriesData.bm}/>
      <Addons {...addonsData.bm}/>
      <FinalCTA/>
    </main>
  )
}

export default page
