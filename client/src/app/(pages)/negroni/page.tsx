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
  return (
    <main >
      <Hero {...heroes.negroni}/>
      <Packages {...packagesData.negroni}/>
      <Gallery {...galleriesData.negroni}/>
      <Addons {...addonsData.negroni}/>
      <FinalCTA/>
    </main>
  )
}

export default page
